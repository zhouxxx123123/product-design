"""
嵌入向量服务 — 通过 Moonshot AI 将文本转换为 1536 维向量
"""

import structlog
from typing import Optional
from openai import AsyncOpenAI

from core.config import settings

logger = structlog.get_logger(__name__)

# Moonshot embedding model
# 注意：如果 Moonshot 不支持嵌入模型，可以临时使用 text-embedding-3-small 作为 fallback
EMBEDDING_MODEL = "moonshot-v1-embedding"


class EmbeddingService:
    """文本嵌入服务，基于 Moonshot AI (OpenAI-compatible)"""

    def __init__(self) -> None:
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(
                api_key=settings.MOONSHOT_API_KEY,
                base_url=settings.MOONSHOT_BASE_URL,
            )
        return self._client

    async def embed_text(self, text: str) -> list[float]:
        """
        将文本字符串嵌入为 1536 维向量。

        Args:
            text: 要嵌入的文本（会被截断到 8192 tokens 以内）

        Returns:
            list[float]: 1536 维嵌入向量

        Raises:
            ValueError: 如果文本为空
            Exception: 如果 API 调用失败
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")

        # 截断文本避免 token 限制问题
        truncated = text[:8000]

        log = logger.bind(text_length=len(truncated))
        log.info("开始嵌入文本")

        try:
            response = await self.client.embeddings.create(
                input=truncated,
                model=EMBEDDING_MODEL,
            )
            embedding = response.data[0].embedding
            log.info("文本嵌入完成", dimensions=len(embedding))
            return embedding
        except Exception as e:
            log.error("文本嵌入失败", error=str(e))
            raise

    async def close(self) -> None:
        """关闭 HTTP 客户端"""
        if self._client is not None:
            await self._client.close()


# 服务单例
embedding_service = EmbeddingService()


async def close_embedding_client() -> None:
    """关闭 httpx 连接池，供 lifespan 调用"""
    await embedding_service.close()