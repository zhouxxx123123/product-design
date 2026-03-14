"""
文本嵌入端点
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.embedding import embedding_service

router = APIRouter()


class EmbedRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=100_000,
        description="要嵌入的文本",
        example="这是一个示例文本，用于生成嵌入向量。"
    )


class EmbedResponse(BaseModel):
    embedding: list[float] = Field(..., description="1536 维嵌入向量")
    dimensions: int = Field(..., description="向量维度")
    model: str = Field(..., description="使用的嵌入模型")


@router.post("/embed", response_model=EmbedResponse)
async def embed_text(request: EmbedRequest) -> EmbedResponse:
    """
    将文本转换为 1536 维嵌入向量。
    用于案例库中的语义相似度搜索。

    Args:
        request: 嵌入请求，包含要处理的文本

    Returns:
        EmbedResponse: 包含嵌入向量、维度和模型信息

    Raises:
        HTTPException: 400 如果输入无效，500 如果嵌入失败
    """
    try:
        embedding = await embedding_service.embed_text(request.text)
        return EmbedResponse(
            embedding=embedding,
            dimensions=len(embedding),
            model="moonshot-v1-embedding",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"嵌入生成失败: {str(e)}"
        ) from e