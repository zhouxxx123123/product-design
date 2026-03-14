"""
洞察提取端点
"""

import httpx
import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from services.insight import insight_service

logger = structlog.get_logger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class InsightRequest(BaseModel):
    transcript: str
    interview_id: Optional[str] = None
    extract_themes: Optional[bool] = True
    extract_quotes: Optional[bool] = True
    extract_sentiment: Optional[bool] = True


class ThemeItem(BaseModel):
    title: str
    description: str
    evidence: List[str] = []


class QuoteItem(BaseModel):
    text: str
    speaker: str = ""
    timestamp: str = ""


class SentimentInfo(BaseModel):
    score: float = 0.0
    label: str = "neutral"
    breakdown: dict = {}


class InsightResponse(BaseModel):
    themes: List[dict] = []
    key_quotes: List[dict] = []
    sentiment: Optional[dict] = None
    summary: str = ""


class SummarizeRequest(BaseModel):
    transcript: str
    max_length: Optional[int] = 500


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_insight_response(parsed: object, raw_content: str) -> InsightResponse:
    """Map parsed LLM output to InsightResponse, with graceful fallback."""
    if isinstance(parsed, dict):
        # 兼容英文 key 和 LLM 可能输出的中文 key
        themes = (
            parsed.get("themes")
            or parsed.get("关键主题")
            or []
        )
        key_quotes = (
            parsed.get("key_quotes")
            or parsed.get("quotes")
            or parsed.get("重要引用")
            or []
        )
        sentiment = (
            parsed.get("sentiment")
            or parsed.get("sentiment_analysis")
            or parsed.get("情感分析")
        )
        summary = (
            parsed.get("summary")
            or parsed.get("总体摘要")
            or ""
        )
        return InsightResponse(
            themes=themes,
            key_quotes=key_quotes,
            sentiment=sentiment,
            summary=summary,
        )
    # Fallback: parsing failed — wrap raw text in a minimal structure
    return InsightResponse(
        themes=[],
        key_quotes=[],
        sentiment=None,
        summary=raw_content,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/extract", response_model=InsightResponse)
async def extract_insights(request: InsightRequest) -> InsightResponse:
    """
    提取访谈洞察
    从访谈转录文本中提取关键洞察（主题、引用、情感分析、摘要）
    """
    logger.info(
        "收到洞察提取请求",
        transcript_length=len(request.transcript),
        interview_id=request.interview_id,
    )

    try:
        result = await insight_service.extract_insights(
            transcript=request.transcript,
            extract_themes=request.extract_themes or True,
            extract_quotes=request.extract_quotes or True,
            extract_sentiment=request.extract_sentiment or True,
        )
    except httpx.HTTPStatusError as exc:
        logger.error("洞察提取：上游服务错误", status_code=exc.response.status_code)
        raise HTTPException(
            status_code=502,
            detail=f"上游 LLM 服务错误: {exc.response.status_code}",
        ) from exc
    except Exception as exc:
        logger.error("洞察提取：未知错误", error=str(exc))
        raise HTTPException(status_code=500, detail="内部服务错误") from exc

    return _build_insight_response(result, "")


@router.post("/summarize")
async def summarize_transcript(body: SummarizeRequest):
    """
    生成访谈摘要
    为长文本生成简洁摘要
    """
    logger.info("收到摘要生成请求", transcript_length=len(body.transcript))

    try:
        summary_text = await insight_service.summarize(
            transcript=body.transcript,
            max_length=body.max_length or 500,
        )
    except httpx.HTTPStatusError as exc:
        logger.error("摘要生成：上游服务错误", status_code=exc.response.status_code)
        raise HTTPException(
            status_code=502,
            detail=f"上游 LLM 服务错误: {exc.response.status_code}",
        ) from exc
    except Exception as exc:
        logger.error("摘要生成：未知错误", error=str(exc))
        raise HTTPException(status_code=500, detail="内部服务错误") from exc

    return {"summary": summary_text}
