"""
提纲生成端点
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()


class OutlineRequest(BaseModel):
    topic: str
    research_goals: Optional[str] = None
    target_users: Optional[str] = None
    num_questions: Optional[int] = 10


class OutlineResponse(BaseModel):
    title: str
    sections: List[dict]
    estimated_duration: str


@router.post("/generate")
async def generate_outline(request: OutlineRequest):
    """
    生成访谈提纲
    基于研究主题自动生成访谈问题列表
    """
    return {
        "status": "success",
        "message": "提纲生成端点 - 待实现",
        "topic": request.topic,
    }


@router.post("/optimize")
async def optimize_outline(outline: dict):
    """
    优化现有提纲
    根据反馈优化访谈提纲
    """
    return {
        "status": "success",
        "message": "提纲优化端点 - 待实现",
    }
