"""
嵌入向量服务 — 通过 Moonshot AI 将文本转换为 1536 维向量
"""

import hashlib
import math
import structlog
from typing import Optional
from openai import AsyncOpenAI

from core.config import settings

logger = structlog.get_logger(__name__)

# Moonshot embedding model
# 注意：如果 Moonshot 不支持嵌入模型，可以临时使用 text-embedding-3-small 作为 fallback
EMBEDDING_MODEL = "moonshot-v1-embedding"


def _hash_embed(text: str, dims: int = 1536) -> list[float]:
    """
    基于文本哈希的确定性伪嵌入向量生成器。

    当 Moonshot API 不可用时的降级方案，生成归一化的 1536 维向量。
    使用字符三元组（trigram）的哈希值分布在向量空间中，然后 L2 归一化。

    Args:
        text: 输入文本
        dims: 向量维度，默认 1536

    Returns:
        list[float]: 归一化的伪嵌入向量
    """
    vec = [0.0] * dims

    # 使用重叠的字符三元组（trigram）
    padded = f"__START__ {text} __END__"
    for i in range(len(padded) - 2):
        gram = padded[i:i+3]
        h = int(hashlib.md5(gram.encode()).hexdigest(), 16)
        idx = h % dims
        vec[idx] += 1.0

    # L2 归一化
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


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
                timeout=30.0,
            )
        return self._client

    async def embed_text(self, text: str) -> dict:
        """
        将文本字符串嵌入为 1536 维向量。

        优先使用 Moonshot API，如遇 403/权限错误则降级到哈希嵌入。

        Args:
            text: 要嵌入的文本（会被截断到 8192 tokens 以内）

        Returns:
            dict: {"vector": embedding_vector, "model": model_name}

        Raises:
            ValueError: 如果文本为空
            Exception: 如果 API 调用失败且无法降级
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
            log.info("文本嵌入完成 (Moonshot API)", dimensions=len(embedding))
            return {"vector": embedding, "model": EMBEDDING_MODEL}
        except Exception as e:
            error_str = str(e).lower()
            # 检查是否为权限相关错误 (403, permission_denied, not open 等)
            if any(keyword in error_str for keyword in ["403", "permission_denied", "not open", "forbidden"]):
                log.warning("Moonshot 嵌入 API 不可用，使用哈希降级方案", error=str(e))
                fallback_embedding = _hash_embed(truncated, dims=1536)
                log.info("文本嵌入完成 (哈希降级)", dimensions=len(fallback_embedding))
                return {"vector": fallback_embedding, "model": "hash-fallback"}
            else:
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