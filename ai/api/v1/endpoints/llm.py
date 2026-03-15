"""
LLM (大语言模型) 端点
"""

import json

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import AsyncGenerator, List, Optional

from services.llm import llm_service

logger = structlog.get_logger(__name__)

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "kimi-k2.5"
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2000
    stream: Optional[bool] = False


class ChatResponse(BaseModel):
    content: str
    usage: dict
    model: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    非流式对话接口
    调用 Kimi-k2.5 模型并返回完整响应
    """
    logger.info("收到对话请求", message_count=len(request.messages))

    try:
        response_data = await llm_service.chat(
            messages=[m.dict() for m in request.messages],
            temperature=request.temperature or 0.7,
            max_tokens=request.max_tokens or 2000,
        )
    except httpx.HTTPStatusError as exc:
        logger.error(
            "上游 LLM 服务返回错误",
            status_code=exc.response.status_code,
            detail=exc.response.text,
        )
        raise HTTPException(
            status_code=502,
            detail=f"上游 LLM 服务错误: {exc.response.status_code}",
        ) from exc
    except Exception as exc:
        logger.error("对话请求发生未知错误", error=str(exc))
        raise HTTPException(status_code=500, detail="内部服务错误") from exc

    content: str = response_data["choices"][0]["message"]["content"]
    usage: dict = response_data.get("usage", {})
    model: str = response_data.get("model", request.model or "kimi-k2.5")

    return ChatResponse(content=content, usage=usage, model=model)


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """
    流式对话接口
    以 SSE (text/event-stream) 格式逐块返回模型输出
    """
    logger.info("收到流式对话请求", message_count=len(request.messages))

    async def generate() -> AsyncGenerator[str, None]:
        try:
            async for chunk in llm_service.chat_stream(
                messages=[m.dict() for m in request.messages],
                temperature=request.temperature or 0.7,
                max_tokens=request.max_tokens or 2000,
            ):
                if chunk:
                    # 包装为 OpenAI 兼容的 SSE JSON 格式
                    sse_payload = json.dumps(
                        {"choices": [{"delta": {"content": chunk}, "finish_reason": None}]},
                        ensure_ascii=False,
                    )
                    yield f"data: {sse_payload}\n\n"
        except httpx.HTTPStatusError as exc:
            logger.error(
                "流式请求上游错误",
                status_code=exc.response.status_code,
            )
            yield f'data: {{"error": "上游服务错误 {exc.response.status_code}"}}\n\n'
        except Exception as exc:
            logger.error("LLM stream error: %s", exc)
            yield 'data: {"error": "请求处理失败，请重试"}\n\n'
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/chat/copilot/stream")
async def copilot_chat_stream(request: ChatRequest) -> StreamingResponse:
    """
    Copilot 增强流式对话接口。

    系统提示由服务端自动注入，客户端只需传入用户消息。
    响应以 SSE (text/event-stream) 格式输出，包含两种事件类型：

    普通文本片段::

        data: {"choices": [{"delta": {"content": "..."}, "finish_reason": null}]}

    Tool call 块 (AI 触发系统动作)::

        event: tool_call
        data: {"tool_call": {...}}

    流结束标志::

        data: [DONE]
    """
    logger.info("收到 Copilot 流式请求", message_count=len(request.messages))

    async def generate() -> AsyncGenerator[str, None]:
        try:
            async for event_type, payload in llm_service.copilot_stream(
                messages=[m.dict() for m in request.messages],
                max_tokens=request.max_tokens or 4000,
            ):
                if event_type == "text":
                    if payload:
                        sse_payload = json.dumps(
                            {
                                "choices": [
                                    {"delta": {"content": payload}, "finish_reason": None}
                                ]
                            },
                            ensure_ascii=False,
                        )
                        yield f"data: {sse_payload}\n\n"
                elif event_type == "tool_call":
                    yield f"event: tool_call\ndata: {payload}\n\n"
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Copilot 流式请求上游错误",
                status_code=exc.response.status_code,
            )
            yield f'data: {{"error": "上游服务错误 {exc.response.status_code}"}}\n\n'
        except Exception as exc:
            logger.error("Copilot stream error", error=str(exc))
            yield 'data: {"error": "请求处理失败，请重试"}\n\n'
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
