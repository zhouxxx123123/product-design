"""
提纲生成端点
"""

import json
import re
import httpx
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from services.llm import llm_service

logger = structlog.get_logger(__name__)

router = APIRouter()

_SYSTEM_PROMPT_GENERATE = (
    "你是一名专业的商业调研专家，根据给定主题生成结构化的访谈提纲，以JSON格式返回。"
)

_SYSTEM_PROMPT_OPTIMIZE = (
    "你是一名专业的商业调研专家，擅长优化和补充访谈问题。"
    "请根据提供的章节内容和背景，给出补充问题列表，以JSON数组格式返回。"
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


class OutlineRequest(BaseModel):
    topic: str
    research_goals: Optional[str] = None
    target_users: Optional[str] = None
    num_questions: Optional[int] = 10


class OutlineResponse(BaseModel):
    title: str
    sections: List[dict]
    estimated_duration: str


class OptimizeRequest(BaseModel):
    section: Dict[str, Any]
    background: Optional[str] = ""


class OptimizeResponse(BaseModel):
    questions: List[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _strip_markdown_json(text: str) -> str:
    """
    移除 AI 输出中可能包裹 JSON 的 markdown 代码块。

    例如::

        ```json
        { ... }
        ```

    会被清理为纯 JSON 字符串。
    """
    pattern = r"```(?:json)?\s*([\s\S]*?)```"
    match = re.search(pattern, text.strip())
    if match:
        return match.group(1).strip()
    return text.strip()


def _parse_json_safe(text: str) -> Any:
    """
    尝试解析 JSON，失败时返回原始文本字符串。
    """
    cleaned = _strip_markdown_json(text)
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("JSON 解析失败，返回原始内容", raw=cleaned[:200])
        return cleaned


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/generate")
async def generate_outline(request: OutlineRequest):
    """
    生成访谈提纲
    基于研究主题调用 Kimi-k2.5 自动生成结构化访谈问题
    """
    logger.info("收到提纲生成请求", topic=request.topic)

    user_message = (
        f"主题：{request.topic}\n"
        f"目标：{request.research_goals or '了解客户需求'}\n"
        f"请生成包含{request.num_questions or 10}个问题的访谈提纲，"
        '格式：{"title": "...", "sections": [{"title": "...", "questions": ["..."]}]}'
    )

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT_GENERATE},
        {"role": "user", "content": user_message},
    ]

    try:
        response_data = await llm_service.chat(messages=messages)
    except httpx.HTTPStatusError as exc:
        logger.error("提纲生成：上游服务错误", status_code=exc.response.status_code)
        raise HTTPException(
            status_code=502,
            detail=f"上游 LLM 服务错误: {exc.response.status_code}",
        ) from exc
    except Exception as exc:
        logger.error("提纲生成：未知错误", error=str(exc))
        raise HTTPException(status_code=500, detail="内部服务错误") from exc

    raw_content: str = response_data["choices"][0]["message"]["content"]
    parsed = _parse_json_safe(raw_content)

    # Wrap ALL responses in consistent ApiResponse envelope
    if isinstance(parsed, dict):
        return {"success": True, "data": parsed, "error": None}

    return {
        "success": True,
        "data": {
            "title": request.topic,
            "sections": [],
            "raw_content": parsed,
        },
        "error": None,
    }


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_outline(request: OptimizeRequest) -> OptimizeResponse:
    """
    优化章节问题
    根据章节内容和背景，使用 Kimi-k2.5 补充额外访谈问题
    """
    section_title = request.section.get("title", "未命名章节")
    existing_questions = request.section.get("questions", [])

    logger.info("收到提纲优化请求", section=section_title)

    user_message = (
        f"章节标题：{section_title}\n"
        f"现有问题：{json.dumps(existing_questions, ensure_ascii=False)}\n"
        f"背景信息：{request.background or '无'}\n"
        "请补充5-8个高质量的追加访谈问题，以JSON数组格式返回，例如：[\"问题1\", \"问题2\"]"
    )

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT_OPTIMIZE},
        {"role": "user", "content": user_message},
    ]

    try:
        response_data = await llm_service.chat(messages=messages)
    except httpx.HTTPStatusError as exc:
        logger.error("提纲优化：上游服务错误", status_code=exc.response.status_code)
        raise HTTPException(
            status_code=502,
            detail=f"上游 LLM 服务错误: {exc.response.status_code}",
        ) from exc
    except Exception as exc:
        logger.error("提纲优化：未知错误", error=str(exc))
        raise HTTPException(status_code=500, detail="内部服务错误") from exc

    raw_content: str = response_data["choices"][0]["message"]["content"]
    parsed = _parse_json_safe(raw_content)

    if isinstance(parsed, list):
        questions = [str(q) for q in parsed]
    else:
        # 解析失败时将整段文本作为单条问题返回，保证结构不破坏
        questions = [str(parsed)]

    return OptimizeResponse(questions=questions)
