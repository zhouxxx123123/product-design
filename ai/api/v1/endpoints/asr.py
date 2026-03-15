"""
ASR (语音识别) 端点
"""

import asyncio
import structlog
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.websockets import WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from pydantic import BaseModel

from core.config import settings
from services.asr import asr_service

logger = structlog.get_logger(__name__)

router = APIRouter()


class RecognizeUrlRequest(BaseModel):
    audio_url: str


@router.post("/recognize/file")
async def recognize_file(file: UploadFile = File(...)):
    """
    录音文件识别
    上传音频文件进行语音识别
    """
    logger.info("收到录音文件识别请求", filename=file.filename)
    try:
        content = await file.read()
        result = await asr_service.recognize_file(content, file.filename or "audio")
        return result
    except Exception as exc:
        logger.error("录音文件识别失败", error=str(exc))
        raise HTTPException(status_code=500, detail="语音识别失败") from exc


@router.post("/recognize/url")
async def recognize_url(body: RecognizeUrlRequest):
    """
    URL音频文件识别
    通过URL识别远程音频文件
    """
    logger.info("收到URL音频识别请求", url=body.audio_url)
    try:
        result = await asr_service.recognize_url(body.audio_url)
        return result
    except Exception as exc:
        logger.error("URL音频识别失败", error=str(exc))
        raise HTTPException(status_code=500, detail="语音识别失败") from exc


@router.websocket("/stream")
async def recognize_stream(websocket: WebSocket, token: str = Query(None)):
    """
    实时流式语音识别 WebSocket
    支持实时音频流传输和识别结果返回

    连接时须在查询参数中携带有效 JWT：ws://…/stream?token=<jwt>
    """
    if not token:
        await websocket.close(code=4001)
        return
    try:
        if not settings.JWT_SECRET:
            logger.warning("JWT_SECRET 未配置，跳过 token 验证（仅开发模式）")
        else:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            # jwt.decode raises JWTError if expired (includes ExpiredSignatureError)
    except JWTError as exc:
        logger.warning("WebSocket JWT验证失败", error=str(exc))
        await websocket.close(code=4001)
        return
    await websocket.accept()
    logger.info("WebSocket 实时识别连接建立")

    WEBSOCKET_TIMEOUT = 60.0  # seconds of inactivity before close

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_bytes(), timeout=WEBSOCKET_TIMEOUT)
            except asyncio.TimeoutError:
                logger.info("WebSocket 超时，主动关闭连接")
                await websocket.close(code=1000)
                break

            # Handle ping message
            if data == b"ping":
                await websocket.send_text("pong")
                continue

            result = await asr_service.recognize_realtime(data)
            await websocket.send_json(result)
    except WebSocketDisconnect:
        logger.info("WebSocket 实时识别连接断开")
    except Exception as exc:
        logger.error("WebSocket 实时识别异常", error=str(exc))
        await websocket.close()
