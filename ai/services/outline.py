"""
提纲生成服务
"""

import structlog
from typing import List, Dict, Optional

from services.llm import llm_service
from utils.json_parser import _parse_json_safe

logger = structlog.get_logger(__name__)


class OutlineService:
    """访谈提纲生成服务"""

    SYSTEM_PROMPT = """你是一位专业的用户研究专家，擅长设计结构化的用户访谈提纲。
请根据提供的研究主题，生成一份详细的访谈提纲，包括：
1. 开场白和破冰问题
2. 核心研究问题（按逻辑顺序排列）
3. 追问提示
4. 结束语

要求：
- 问题要开放式，避免引导性
- 问题之间要有逻辑递进关系
- 考虑受访者的背景和可能回答
- 预估每个部分的访谈时长"""

    OPTIMIZE_SYSTEM_PROMPT = (
        "你是一位专业的用户研究专家，根据反馈意见对访谈提纲进行优化和改进。"
        "保持原有结构，根据反馈调整问题措辞、增删问题或重新排序，以JSON格式返回优化后的完整提纲。"
    )

    async def generate(
        self,
        topic: str,
        research_goals: Optional[str] = None,
        target_users: Optional[str] = None,
        num_questions: int = 10,
    ) -> Dict:
        """
        生成访谈提纲
        """
        logger.info("开始生成提纲", topic=topic, num_questions=num_questions)

        prompt = f"""请为以下研究主题生成访谈提纲：

主题：{topic}
研究目标：{research_goals or '了解用户需求和行为'}
目标用户：{target_users or '普通用户'}
问题数量：约{num_questions}个问题

请按JSON格式返回结果，包含以下字段：
- title: 提纲标题
- sections: 访谈章节列表，每个章节包含name(章节名)、questions(问题列表)
- estimated_duration: 预估访谈时长"""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await llm_service.chat(messages, temperature=0.7)
            content = response["choices"][0]["message"]["content"]
            parsed = _parse_json_safe(content)
            if isinstance(parsed, dict):
                return parsed
            # Graceful fallback: LLM returned non-JSON text
            return {
                "title": topic,
                "sections": [],
                "estimated_duration": "",
                "raw_content": parsed,
            }
        except Exception as e:
            logger.error("提纲生成失败", error=str(e))
            raise

    async def optimize(self, outline: Dict, feedback: str) -> Dict:
        """
        根据反馈优化提纲
        """
        logger.info("开始优化提纲", feedback=feedback[:100])

        import json as _json
        outline_json = _json.dumps(outline, ensure_ascii=False, indent=2)

        prompt = (
            f"请根据以下反馈意见优化访谈提纲：\n\n"
            f"反馈意见：{feedback}\n\n"
            f"当前提纲：\n{outline_json}\n\n"
            "请保持JSON格式返回优化后的完整提纲，字段与原提纲保持一致。"
        )

        messages = [
            {"role": "system", "content": self.OPTIMIZE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await llm_service.chat(messages, temperature=0.5)
            content = response["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error("提纲优化失败", error=str(e))
            raise

        parsed = _parse_json_safe(content)
        if isinstance(parsed, dict):
            return parsed
        # Fallback: LLM output unparsable — return a shallow copy of the original outline
        # (copy avoids returning the same mutable reference, preventing silent mutation of caller's data)
        logger.warning("提纲优化：无法解析LLM输出，返回原始提纲副本")
        return dict(outline)


# 服务单例
outline_service = OutlineService()
