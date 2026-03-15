"""
中科琉光调研工具 - AI服务
FastAPI应用主入口
"""

import logging
import sys
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from core.config import settings
from core.logging import configure_logging
from api.v1.router import api_router
from services.llm import close_llm_client
from services.embedding import close_embedding_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # Startup
    configure_logging()
    logger = structlog.get_logger()
    if not settings.MOONSHOT_API_KEY:
        logger.error("MOONSHOT_API_KEY 未配置，LLM 功能将不可用")
    logger.info("Starting AI Service", version=settings.APP_VERSION)
    yield
    # Shutdown
    await close_llm_client()
    await close_embedding_client()
    logger.info("Shutting down AI Service")


# 创建FastAPI应用
app = FastAPI(
    title="中科琉光AI服务",
    description="Liuguang Research Tool AI Service",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# 中间件
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "version": settings.APP_VERSION}


@app.get("/")
async def root():
    """根端点"""
    return {
        "name": "中科琉光AI服务",
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.DEBUG else None,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
