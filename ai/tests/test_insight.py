"""
ai/tests/test_insight.py

Unit tests for InsightService.extract_insights().
LLM calls are mocked via AsyncMock so no real API key is needed.
"""
import pytest
import json
from unittest.mock import AsyncMock, MagicMock

from services.insight import InsightService


VALID_LLM_RESPONSE = {
    "choices": [
        {
            "message": {
                "content": json.dumps({
                    "themes": [
                        {
                            "title": "手续费过高",
                            "description": "用户反映跨境支付手续费是国内的5倍",
                            "evidence": ["手续费太高了，我们不能接受"],
                        }
                    ],
                    "key_quotes": [
                        {
                            "text": "手续费太高了，我们不能接受",
                            "speaker": "受访者A",
                            "insight": "价格敏感度高",
                        }
                    ],
                    "sentiment": {
                        "label": "negative",
                        "score": -0.7,
                        "breakdown": {"正面": 10, "中性": 20, "负面": 70},
                    },
                    "summary": "用户对跨境支付手续费高度不满，希望降低成本。",
                })
            }
        }
    ]
}


@pytest.mark.asyncio
class TestInsightServiceExtract:
    async def test_returns_structured_dict(self):
        import services.insight as insight_module
        original_llm = insight_module.llm_service
        insight_module.llm_service = MagicMock()
        insight_module.llm_service.chat = AsyncMock(return_value=VALID_LLM_RESPONSE)
        service = InsightService()

        try:
            result = await service.extract_insights(
                transcript="用户反映跨境支付手续费太高，流程繁琐",
                extract_themes=True,
                extract_quotes=True,
                extract_sentiment=True,
            )
        finally:
            insight_module.llm_service = original_llm

        assert result["status"] == "success"
        assert isinstance(result["themes"], list)
        assert len(result["themes"]) == 1
        assert result["themes"][0]["title"] == "手续费过高"
        assert isinstance(result["key_quotes"], list)
        assert isinstance(result["sentiment"], dict)
        assert result["sentiment"]["label"] == "negative"
        assert isinstance(result["summary"], str)

    async def test_themes_have_required_fields(self):
        import services.insight as insight_module
        original_llm = insight_module.llm_service
        insight_module.llm_service = MagicMock()
        insight_module.llm_service.chat = AsyncMock(return_value=VALID_LLM_RESPONSE)

        service = InsightService()
        try:
            result = await service.extract_insights("测试文本")
        finally:
            insight_module.llm_service = original_llm

        for theme in result["themes"]:
            assert "title" in theme
            assert "description" in theme
            assert "evidence" in theme

    async def test_graceful_fallback_on_non_json_llm_response(self):
        """When LLM returns plain text instead of JSON, result should still be a dict."""
        fallback_response = {
            "choices": [{"message": {"content": "无法生成结构化洞察，请重试。"}}]
        }
        import services.insight as insight_module
        original_llm = insight_module.llm_service
        insight_module.llm_service = MagicMock()
        insight_module.llm_service.chat = AsyncMock(return_value=fallback_response)

        service = InsightService()
        try:
            result = await service.extract_insights("测试文本")
        finally:
            insight_module.llm_service = original_llm

        assert result["status"] == "success"
        assert result["themes"] == []
        assert result["key_quotes"] == []
        assert isinstance(result["summary"], str)

    async def test_propagates_llm_exception(self):
        """If LLM raises, extract_insights should re-raise."""
        import services.insight as insight_module
        original_llm = insight_module.llm_service
        insight_module.llm_service = MagicMock()
        insight_module.llm_service.chat = AsyncMock(
            side_effect=RuntimeError("API unavailable")
        )

        service = InsightService()
        try:
            with pytest.raises(RuntimeError, match="API unavailable"):
                await service.extract_insights("测试文本")
        finally:
            insight_module.llm_service = original_llm
