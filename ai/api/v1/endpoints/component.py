"""
Component generation endpoint.

POST /component/generate — given a natural-language description of a UI component,
returns a JSON schema that the frontend can use to render the component dynamically.
"""

import json
from typing import Any, Dict, Optional

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict

from services.llm import llm_service

logger = structlog.get_logger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# System prompt for the component-generation call (non-streaming, focused).
# ---------------------------------------------------------------------------
_COMPONENT_SYSTEM_PROMPT = """You are a UI schema generator. Given a description of a UI component, output a JSON schema.

Output ONLY valid JSON, no markdown, no explanation.

Schema format:
{
  "layout": "list|grid|form|table|card",
  "draggable": true|false,
  "title": "optional title",
  "items": {
    "type": "text_input|textarea|badge|checkbox|rating|date_display",
    "label": "optional",
    "field": "data_key",
    "deletable": true|false,
    "required": true|false
  },
  "columns": [...],
  "toolbar": [
    {"type": "append_item|api_call", "label": "...", "endpoint": "...", "method": "POST"}
  ],
  "submit": {
    "type": "submit",
    "label": "...",
    "endpoint": "...",
    "method": "POST"
  }
}

Notes:
- "columns" is only needed for table layout: [{"key": "...", "label": "..."}]
- "toolbar" and "submit" are optional — only include when relevant
- Keep the schema concise and directly usable by a renderer
"""


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class ComponentGenerateRequest(BaseModel):
    """Request body for component generation."""

    description: str = Field(..., min_length=1, description="组件描述")
    context: Optional[Dict[str, Any]] = None


class ComponentGenerateResponse(BaseModel):
    """Response containing the generated component schema."""

    model_config = ConfigDict(populate_by_name=True)

    schema_: Dict[str, Any] = Field(..., alias="schema")


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/generate", response_model=ComponentGenerateResponse)
async def generate_component(
    request: ComponentGenerateRequest,
) -> ComponentGenerateResponse:
    """
    Generate a UI component schema from a natural-language description.

    The AI is instructed to output raw JSON only.  The endpoint validates the
    JSON before returning it to the caller.

    Example request body::

        {
          "description": "可拖拽排序的访谈问题列表，支持新增和删除每条问题"
        }
    """
    logger.info("收到 Component 生成请求", description=request.description[:120])

    # Build messages — optionally include context as a second user turn
    messages = [
        {"role": "system", "content": _COMPONENT_SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_message(request)},
    ]

    try:
        response_data = await llm_service.chat(
            messages=messages,
            temperature=0.3,  # Lower temperature for deterministic schema output
            max_tokens=1500,
        )
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Component 生成：上游 LLM 错误",
            status_code=exc.response.status_code,
            detail=exc.response.text,
        )
        raise HTTPException(
            status_code=502,
            detail=f"上游 LLM 服务错误: {exc.response.status_code}",
        ) from exc
    except Exception as exc:
        logger.error("Component 生成请求失败", error=str(exc))
        raise HTTPException(status_code=500, detail="内部服务错误") from exc

    raw_content: str = response_data["choices"][0]["message"]["content"] or ""

    # Strip potential markdown fences the model may still output despite instructions
    cleaned = _strip_markdown_fences(raw_content.strip())

    try:
        schema: Dict[str, Any] = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error(
            "Component 生成：无法解析 AI 返回的 JSON",
            raw=raw_content[:400],
            error=str(exc),
        )
        raise HTTPException(
            status_code=422,
            detail="AI 返回的 component schema 不是有效 JSON，请重试。",
        ) from exc

    if not isinstance(schema, dict):
        raise HTTPException(
            status_code=422,
            detail="AI 返回的 component schema 必须是 JSON 对象。",
        )

    logger.info("Component schema 生成成功", layout=schema.get("layout", "unknown"))
    return ComponentGenerateResponse(schema_=schema)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_user_message(request: ComponentGenerateRequest) -> str:
    """Construct the user message, optionally embedding context information."""
    parts = [f"请为以下描述生成 UI component schema:\n\n{request.description}"]
    if request.context:
        try:
            context_str = json.dumps(request.context, ensure_ascii=False, indent=2)
            parts.append(f"\n\n附加上下文 (JSON):\n{context_str}")
        except (TypeError, ValueError):
            # If context cannot be serialised, skip it gracefully
            logger.warning("Component 请求的 context 无法序列化，已忽略")
    return "".join(parts)


def _strip_markdown_fences(text: str) -> str:
    """Remove leading/trailing ```json ... ``` or ``` ... ``` fences if present."""
    if text.startswith("```"):
        # Drop opening fence line
        newline_pos = text.find("\n")
        if newline_pos != -1:
            text = text[newline_pos + 1:]
    if text.endswith("```"):
        text = text[: text.rfind("```")].rstrip()
    return text
