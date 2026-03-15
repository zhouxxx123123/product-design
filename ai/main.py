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
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

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

    # Critical security check - JWT_SECRET must be set in production
    if not settings.JWT_SECRET:
        if settings.DEBUG:
            logger.warning("JWT_SECRET 未配置，WebSocket ASR token 验证已跳过（仅开发模式）")
        else:
            logger.error("JWT_SECRET is not configured - refusing to start in production!")
            raise RuntimeError(
                "JWT_SECRET is not configured. "
                "Set JWT_SECRET environment variable before starting the server."
            )

    if not settings.MOONSHOT_API_KEY:
        logger.warning("MOONSHOT_API_KEY 未配置，LLM 功能将不可用")

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
# 自定义 CORS 中间件：跳过 WebSocket 升级请求（Starlette CORSMiddleware 会对所有 WS 返回 403）
# HTTP 请求正常走 CORS 处理；WS 请求由端点内部的 JWT 验证把关
class SmartCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        # WebSocket 升级请求直接放行，不做 CORS 检查
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)
        # 普通 HTTP 请求添加 CORS 响应头
        response = await call_next(request)
        origin = request.headers.get("origin")
        if origin and (origin in settings.CORS_ORIGINS or settings.DEBUG):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
        return response

app.add_middleware(SmartCORSMiddleware)

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
