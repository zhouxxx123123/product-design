"""
洞察提取服务
"""

import structlog
from typing import List, Dict, Optional

from services.llm import llm_service

logger = structlog.get_logger(__name__)


class InsightService:
    """访谈洞察提取服务"""

    SYSTEM_PROMPT = """你是一位资深的用户研究员，擅长从访谈记录中提取有价值的洞察。
请分析提供的访谈转录文本，提取：
1. 关键主题和发现
2. 有代表性的用户原话（引用）
3. 情感倾向分析
4. 行动建议

输出要求：
- 主题要有清晰的标题和描述
- 引用要标注说话人
- 洞察要有数据支撑
- 提供可执行的改进建议"""

    async def extract_insights(
        self,
        transcript: str,
        extract_themes: bool = True,
        extract_quotes: bool = True,
        extract_sentiment: bool = True,
    ) -> Dict:
        """
        从访谈文本中提取洞察
        """
        logger.info(
            "开始提取洞察",
            transcript_length=len(transcript),
            extract_themes=extract_themes,
            extract_quotes=extract_quotes,
            extract_sentiment=extract_sentiment,
        )

        prompt = f"""请分析以下访谈记录并提取洞察：

{transcript[:8000]}  # 限制输入长度

请提取：
1. 关键主题（3-5个）
2. 重要引用（5-10条）
3. 情感分析
4. 总体摘要

按JSON格式返回。"""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await llm_service.chat(messages, temperature=0.3)
            content = response["choices"][0]["message"]["content"]
            # TODO: 解析JSON响应
            return {
                "status": "success",
                "content": content,
            }
        except Exception as e:
            logger.error("洞察提取失败", error=str(e))
            raise

    async def summarize(self, transcript: str, max_length: int = 500) -> str:
        """
        生成访谈摘要
        """
        logger.info("开始生成摘要", transcript_length=len(transcript))

        prompt = f"""请为以下访谈记录生成摘要（不超过{max_length}字）：

{transcript[:6000]}

摘要要求：
- 包含主要话题和发现
- 突出重点用户反馈
- 简洁明了"""

        messages = [
            {"role": "user", "content": prompt},
        ]

        try:
            response = await llm_service.chat(messages, temperature=0.3)
            return response["choices"][0]["message"]["content"]
        except Exception as e:
            logger.error("摘要生成失败", error=str(e))
            raise


# 服务单例
insight_service = InsightService()
