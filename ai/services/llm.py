"""
LLM服务 (Kimi-k2.5)
"""

import json
import structlog
from typing import AsyncGenerator, Dict, List, Optional, Tuple
from openai import AsyncOpenAI
from core.config import settings

logger = structlog.get_logger(__name__)

# Unicode control characters used as JSON block delimiters in copilot responses
_STX = "\x02"  # Start of Text — marks beginning of tool_call JSON block
_ETX = "\x03"  # End of Text — marks end of tool_call JSON block


class LLMService:
    """Kimi大语言模型服务"""

    copilot_system_prompt: str = (
        "You are OpenClaw Copilot, the AI assistant for 中科琉光调研工具 (OpenClaw Research Tool).\n\n"
        "You help users with:\n"
        "- Creating and managing research sessions (调研会话)\n"
        "- Searching case libraries (案例库)\n"
        "- Analyzing client data (客户数据)\n"
        "- Generating interview outlines (访谈大纲)\n"
        "- Navigating the system\n\n"
        "## Response Protocol\n\n"
        "For conversational responses, answer normally in Chinese.\n\n"
        "For SYSTEM ACTIONS, you MUST output a JSON block delimited by \x02 and \x03:\n"
        "\x02{\"tool_call\": {...}}\x03\n\n"
        "## tool_call JSON Schema\n\n"
        "{\n"
        "  \"tool_call\": {\n"
        "    \"intent\": \"create_session|search_cases|navigate|generate_outline|custom_component|search_clients|create_template\",\n"
        "    \"risk\": \"low|high\",\n"
        "    \"component\": {\n"
        "      \"type\": \"confirm_form|result_card|search_results|nav_button|generated\",\n"
        "      ...component-specific fields...\n"
        "    },\n"
        "    \"text\": \"Brief explanation shown to user\"\n"
        "  }\n"
        "}\n\n"
        "## Risk Levels\n"
        "- \"low\": Execute immediately without confirmation (search, navigate, read operations)\n"
        "- \"high\": Show confirmation form before executing (create, update, delete operations)\n\n"
        "## Component Types\n\n"
        "### confirm_form (for high-risk operations needing user input)\n"
        "{\n"
        "  \"type\": \"confirm_form\",\n"
        "  \"title\": \"创建调研会话\",\n"
        "  \"fields\": [\n"
        "    {\"name\": \"title\", \"label\": \"会话标题\", \"type\": \"text\", \"required\": true, \"defaultValue\": \"...\"},\n"
        "    {\"name\": \"clientId\", \"label\": \"客户\", \"type\": \"select\", \"required\": true}\n"
        "  ],\n"
        "  \"action\": \"POST /api/v1/sessions\",\n"
        "  \"data\": {}\n"
        "}\n\n"
        "### result_card (show operation result)\n"
        "{\n"
        "  \"type\": \"result_card\",\n"
        "  \"title\": \"会话已创建\",\n"
        "  \"subtitle\": \"调研会话创建成功\",\n"
        "  \"attributes\": [{\"label\": \"标题\", \"value\": \"...\"}],\n"
        "  \"actions\": [{\"label\": \"前往工作台\", \"url\": \"/workspace\", \"variant\": \"primary\"}]\n"
        "}\n\n"
        "### search_results (list of search results)\n"
        "{\n"
        "  \"type\": \"search_results\",\n"
        "  \"title\": \"找到 5 个相关案例\",\n"
        "  \"items\": [{\"id\": \"1\", \"title\": \"...\", \"subtitle\": \"...\", \"meta\": \"2024-01\", \"url\": \"/cases/1\"}],\n"
        "  \"emptyText\": \"未找到相关案例\"\n"
        "}\n\n"
        "### nav_button (quick navigation)\n"
        "{\n"
        "  \"type\": \"nav_button\",\n"
        "  \"label\": \"前往案例库\",\n"
        "  \"description\": \"浏览所有案例\",\n"
        "  \"path\": \"/cases\"\n"
        "}\n\n"
        "### generated (custom dynamic component)\n"
        "{\n"
        "  \"type\": \"generated\",\n"
        "  \"description\": \"可拖拽排序的访谈问题列表，支持新增和删除\"\n"
        "}\n\n"
        "## Decision Rules\n"
        "1. User asks a question → answer in text\n"
        "2. User wants to CREATE something → high risk, confirm_form\n"
        "3. User wants to SEARCH something → low risk, search_results (you can mock reasonable results)\n"
        "4. User wants to NAVIGATE → low risk, nav_button\n"
        "5. User wants a CUSTOM UI (list editor, table, complex form) → generated component\n"
        "6. Always include \"text\" field with a brief explanation\n"
        "7. Output only ONE tool_call block per response (or none for pure text responses)"
    )

    def __init__(self) -> None:
        self.api_key = settings.MOONSHOT_API_KEY
        self.base_url = settings.MOONSHOT_BASE_URL
        self.model = settings.MOONSHOT_MODEL
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
        )

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> Dict:
        """
        对话请求
        """
        logger.info("发送对话请求", model=self.model, message_count=len(messages))

        try:
            # Kimi-k2.5 只支持 temperature=1
            if self.model == "kimi-k2.5":
                temperature = 1.0
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return {
                "choices": [
                    {
                        "message": {
                            "content": response.choices[0].message.content
                        }
                    }
                ]
            }
        except Exception as e:
            logger.error("对话请求失败", error=str(e))
            raise

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> AsyncGenerator[str, None]:
        """
        流式对话请求
        """
        logger.info("发送流式对话请求", model=self.model)

        if self.model == "kimi-k2.5":
            temperature = 1.0

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as e:
            logger.error("流式对话请求失败", error=str(e))
            raise

    async def copilot_stream(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 4000,
    ) -> AsyncGenerator[Tuple[str, str], None]:
        """
        Copilot 流式对话 — 自动注入系统提示，并将响应拆分为普通文本和 tool_call 块。

        Yields tuples of:
            ("text", chunk)           — regular text fragment
            ("tool_call", json_str)   — complete JSON string extracted from \\x02...\\x03 delimiters
        """
        system_message: Dict[str, str] = {
            "role": "system",
            "content": self.copilot_system_prompt,
        }
        full_messages = [system_message, *messages]

        logger.info(
            "发送 Copilot 流式请求",
            model=self.model,
            message_count=len(full_messages),
        )

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                temperature=1.0,  # Kimi-k2.5 only supports temperature=1
                max_tokens=max_tokens,
                stream=True,
            )
        except Exception as exc:
            logger.error("Copilot 流式请求初始化失败", error=str(exc))
            raise

        # Accumulate raw tokens; flush plain text eagerly, buffer JSON blocks
        buffer: str = ""
        inside_block: bool = False  # True once we've seen \x02 but not yet \x03

        try:
            async for chunk in stream:
                delta: Optional[str] = chunk.choices[0].delta.content
                if not delta:
                    continue

                buffer += delta

                # Process buffer incrementally until no more progress can be made
                while buffer:
                    if inside_block:
                        # Waiting for the closing ETX marker
                        etx_pos = buffer.find(_ETX)
                        if etx_pos == -1:
                            # ETX not yet arrived — keep buffering
                            break
                        # Found ETX: extract JSON between the implicit STX (already consumed)
                        # and the ETX at etx_pos.  Everything before etx_pos is the JSON.
                        json_str = buffer[:etx_pos]
                        buffer = buffer[etx_pos + 1:]
                        inside_block = False

                        try:
                            json.loads(json_str)  # validate; raises ValueError if malformed
                        except (json.JSONDecodeError, ValueError) as parse_err:
                            logger.error(
                                "Copilot tool_call JSON 解析失败",
                                raw=json_str[:200],
                                error=str(parse_err),
                            )
                            # Yield a structured error payload so the client can surface it
                            error_payload = json.dumps(
                                {
                                    "tool_call": {
                                        "intent": "error",
                                        "risk": "low",
                                        "text": "AI 返回的操作数据格式有误，请重试。",
                                        "component": None,
                                    }
                                },
                                ensure_ascii=False,
                            )
                            yield ("tool_call", error_payload)
                        else:
                            yield ("tool_call", json_str)
                    else:
                        # Looking for the opening STX marker
                        stx_pos = buffer.find(_STX)
                        if stx_pos == -1:
                            # No STX in buffer — yield everything as plain text
                            yield ("text", buffer)
                            buffer = ""
                            break
                        # Flush text before the STX marker
                        if stx_pos > 0:
                            yield ("text", buffer[:stx_pos])
                        # Drop the STX character and switch to block-buffering mode
                        buffer = buffer[stx_pos + 1:]
                        inside_block = True
        except Exception as exc:
            logger.error("Copilot 流式读取失败", error=str(exc))
            raise

        # Flush any remaining plain text (no STX encountered at end of stream)
        if buffer and not inside_block:
            yield ("text", buffer)

    async def close(self) -> None:
        """关闭HTTP客户端"""
        await self.client.close()


# 服务单例
llm_service = LLMService()


async def close_llm_client() -> None:
    """关闭 httpx 连接池，供 lifespan 调用"""
    await llm_service.client.close()
