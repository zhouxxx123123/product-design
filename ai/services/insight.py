"""
洞察提取服务
"""

import structlog
from typing import List, Dict, Optional

from services.llm import llm_service
from utils.json_parser import _parse_json_safe

logger = structlog.get_logger(__name__)


class InsightService:
    """访谈洞察提取服务"""

    SYSTEM_PROMPT = """你是一位资深的用户研究员，擅长从访谈记录中提取有价值的洞察。
请严格按照以下 JSON schema 返回结果，不要添加任何 markdown 代码块或额外说明，直接返回纯 JSON：

{
  "themes": [
    {"title": "主题标题", "description": "详细描述", "evidence": ["证据1"]}
  ],
  "key_quotes": [
    {"text": "原话内容", "speaker": "说话人", "insight": "洞察说明"}
  ],
  "sentiment": {
    "label": "positive|neutral|negative",
    "score": 0.0,
    "breakdown": {"正面": 30, "中性": 20, "负面": 50}
  },
  "summary": "总体摘要文字"
}"""

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

{transcript[:8000]}

请严格按照 system prompt 中指定的 JSON schema 提取：
- themes：3-5个关键主题
- key_quotes：5-10条重要引用
- sentiment：情感分析
- summary：总体摘要（200字以内）

直接返回纯 JSON，不要包裹在代码块中。"""

        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await llm_service.chat(messages, temperature=0.3)
            content = response["choices"][0]["message"]["content"]
            parsed = _parse_json_safe(content)
            if isinstance(parsed, dict):
                return {
                    "status": "success",
                    "themes": parsed.get("themes", []),
                    "key_quotes": parsed.get("key_quotes", []),
                    "sentiment": parsed.get("sentiment", {}),
                    "summary": parsed.get("summary", ""),
                }
            # Graceful fallback: LLM returned non-JSON text
            return {
                "status": "success",
                "themes": [],
                "key_quotes": [],
                "sentiment": {},
                "summary": parsed if isinstance(parsed, str) else "",
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
