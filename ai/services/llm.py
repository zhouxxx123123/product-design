"""
LLM服务 (Kimi-k2.5)
"""

import structlog
from typing import List, Dict, Optional, AsyncGenerator
import httpx

from core.config import settings

logger = structlog.get_logger(__name__)


class LLMService:
    """Kimi大语言模型服务"""

    def __init__(self):
        self.api_key = settings.MOONSHOT_API_KEY
        self.base_url = settings.MOONSHOT_BASE_URL
        self.model = settings.MOONSHOT_MODEL
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=60.0,
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
            response = await self.client.post(
                "/chat/completions",
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
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

        try:
            async with self.client.stream(
                "POST",
                "/chat/completions",
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": True,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        yield line[6:]
        except httpx.HTTPStatusError as e:
            logger.error("流式对话请求失败", error=str(e))
            raise

    async def close(self):
        """关闭HTTP客户端"""
        await self.client.aclose()


# 服务单例
llm_service = LLMService()
