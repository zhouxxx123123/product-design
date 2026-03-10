"""
API路由
"""

from fastapi import APIRouter

from api.v1.endpoints import health, asr, llm, outline, insight

api_router = APIRouter()

api_router.include_router(health.router, tags=["health"])
api_router.include_router(asr.router, prefix="/asr", tags=["asr"])
api_router.include_router(llm.router, prefix="/llm", tags=["llm"])
api_router.include_router(outline.router, prefix="/outline", tags=["outline"])
api_router.include_router(insight.router, prefix="/insight", tags=["insight"])
