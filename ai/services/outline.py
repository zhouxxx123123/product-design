"""
提纲生成服务
"""

import structlog
from typing import List, Dict, Optional

from services.llm import llm_service

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
            # TODO: 解析JSON响应
            return {
                "status": "success",
                "content": content,
            }
        except Exception as e:
            logger.error("提纲生成失败", error=str(e))
            raise

    async def optimize(self, outline: Dict, feedback: str) -> Dict:
        """
        根据反馈优化提纲
        """
        logger.info("开始优化提纲", feedback=feedback[:100])
        # TODO: 实现提纲优化逻辑
        return {"status": "success", "outline": outline}


# 服务单例
outline_service = OutlineService()
