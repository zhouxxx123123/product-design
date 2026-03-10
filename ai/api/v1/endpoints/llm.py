"""
LLM (大语言模型) 端点
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

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


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    对话接口
    与Kimi-k2.5模型进行对话
    """
    return {
        "status": "success",
        "message": "LLM对话端点 - 待实现",
        "model": request.model,
    }


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    流式对话接口
    支持SSE流式返回
    """
    return {
        "status": "success",
        "message": "LLM流式对话端点 - 待实现",
        "model": request.model,
    }
