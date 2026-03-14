"""
ai/tests/test_outline.py

Unit tests for OutlineService.generate() and OutlineService.optimize().
LLM calls are mocked via AsyncMock so no real API key is needed.
"""
import pytest
import json
from unittest.mock import AsyncMock, MagicMock

from services.outline import OutlineService


VALID_OUTLINE_RESPONSE = {
    "choices": [
        {
            "message": {
                "content": json.dumps({
                    "title": "跨境支付痛点访谈提纲",
                    "sections": [
                        {
                            "name": "开场破冰",
                            "questions": [
                                "请简单介绍一下您在跨境支付方面的工作背景",
                                "您通常使用哪些跨境支付工具？",
                            ],
                        },
                        {
                            "name": "核心问题",
                            "questions": [
                                "在使用跨境支付时，您遇到过哪些让您印象深刻的问题？",
                                "这些问题对您的业务产生了什么影响？",
                            ],
                        },
                    ],
                    "estimated_duration": "45分钟",
                })
            }
        }
    ]
}


@pytest.mark.asyncio
class TestOutlineServiceGenerate:
    async def test_returns_dict_with_sections(self):
        import services.outline as outline_module
        original_llm = outline_module.llm_service
        outline_module.llm_service = MagicMock()
        outline_module.llm_service.chat = AsyncMock(return_value=VALID_OUTLINE_RESPONSE)

        service = OutlineService()
        try:
            result = await service.generate(
                topic="跨境支付痛点调研",
                research_goals="了解用户在跨境支付中的主要痛点",
                target_users="中小企业财务负责人",
            )
        finally:
            outline_module.llm_service = original_llm

        assert isinstance(result, dict)
        assert "sections" in result
        assert isinstance(result["sections"], list)
        assert len(result["sections"]) == 2

    async def test_sections_have_title_and_questions(self):
        import services.outline as outline_module
        original_llm = outline_module.llm_service
        outline_module.llm_service = MagicMock()
        outline_module.llm_service.chat = AsyncMock(return_value=VALID_OUTLINE_RESPONSE)

        service = OutlineService()
        try:
            result = await service.generate(topic="测试主题")
        finally:
            outline_module.llm_service = original_llm

        for section in result["sections"]:
            assert "name" in section
            assert "questions" in section
            assert isinstance(section["questions"], list)

    async def test_fallback_on_non_json_response(self):
        """When LLM returns plain text, generate() should return a dict with empty sections."""
        fallback_response = {
            "choices": [{"message": {"content": "无法生成提纲，请提供更具体的主题。"}}]
        }
        import services.outline as outline_module
        original_llm = outline_module.llm_service
        outline_module.llm_service = MagicMock()
        outline_module.llm_service.chat = AsyncMock(return_value=fallback_response)

        service = OutlineService()
        try:
            result = await service.generate(topic="模糊主题")
        finally:
            outline_module.llm_service = original_llm

        assert isinstance(result, dict)
        # Either sections list exists (possibly empty) or raw_content fallback
        assert "sections" in result or "raw_content" in result

    async def test_propagates_llm_exception(self):
        import services.outline as outline_module
        original_llm = outline_module.llm_service
        outline_module.llm_service = MagicMock()
        outline_module.llm_service.chat = AsyncMock(
            side_effect=ConnectionError("LLM service down")
        )

        service = OutlineService()
        try:
            with pytest.raises(ConnectionError, match="LLM service down"):
                await service.generate(topic="任何主题")
        finally:
            outline_module.llm_service = original_llm


@pytest.mark.asyncio
class TestOutlineServiceOptimize:
    async def test_optimize_returns_dict(self):
        original_outline = {
            "title": "原始提纲",
            "sections": [{"name": "开场", "questions": ["问题1"]}],
        }
        import services.outline as outline_module
        original_llm = outline_module.llm_service
        outline_module.llm_service = MagicMock()
        outline_module.llm_service.chat = AsyncMock(return_value=VALID_OUTLINE_RESPONSE)

        service = OutlineService()
        try:
            result = await service.optimize(
                outline=original_outline,
                feedback="问题太少，请增加追问",
            )
        finally:
            outline_module.llm_service = original_llm

        assert isinstance(result, dict)

    async def test_optimize_fallback_returns_copy_of_original(self):
        """When LLM output is not parseable, optimize() returns a copy of the original."""
        original_outline = {"title": "原始", "sections": []}
        fallback_response = {
            "choices": [{"message": {"content": "无法优化"}}]
        }
        import services.outline as outline_module
        original_llm = outline_module.llm_service
        outline_module.llm_service = MagicMock()
        outline_module.llm_service.chat = AsyncMock(return_value=fallback_response)

        service = OutlineService()
        try:
            result = await service.optimize(outline=original_outline, feedback="改改")
        finally:
            outline_module.llm_service = original_llm

        assert result == original_outline
        # Must be a copy, not the same object
        assert result is not original_outline
