"""
faster-whisper 本地语音识别服务

接口签名与 TencentASRService 完全相同，可无缝替换：
    recognize_file(file_content, filename) → dict
    recognize_url(audio_url)              → dict
    recognize_realtime(audio_chunk)       → dict

模型延迟加载（首次调用时初始化），线程安全通过 run_in_executor 隔离。
实时识别采用累积缓冲区策略：积累到阈值（≈3秒）才触发一次推理。
"""

import asyncio
import os
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, Optional

import httpx
import structlog

from core.config import settings

if TYPE_CHECKING:
    from faster_whisper import WhisperModel

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# 内部纯函数
# ---------------------------------------------------------------------------


def _build_segments(segments_iter) -> list[dict]:
    """
    将 faster-whisper Segment 迭代器转换为统一 segments 列表。

    - begin_time / end_time: 秒 → 毫秒
    - speaker_tag: 固定 0（whisper 无说话人分离）
    - confidence: 固定 1.0
    - 过滤纯空白 segment
    """
    segments: list[dict] = []
    for seg in segments_iter:
        text = seg.text.strip()
        if not text:
            continue
        segments.append(
            {
                "text": text,
                "begin_time": int(seg.start * 1000),
                "end_time": int(seg.end * 1000),
                "speaker_tag": 0,
                "confidence": 1.0,
            }
        )
    return segments


def _ensure_nonempty(segments: list[dict]) -> list[dict]:
    """保证 segments 非空：若识别结果为空，插入一个空占位 segment。"""
    if segments:
        return segments
    return [
        {
            "text": "",
            "begin_time": 0,
            "end_time": 0,
            "speaker_tag": 0,
            "confidence": 1.0,
        }
    ]


# ---------------------------------------------------------------------------
# 服务类
# ---------------------------------------------------------------------------


class WhisperAsrService:
    """
    faster-whisper 本地语音识别服务。

    设计要点：
    - 模型延迟加载（_get_model），避免导入时即占用内存
    - 所有 CPU 密集型推理通过 run_in_executor 在线程池执行，不阻塞事件循环
    - 实时识别使用字节缓冲区，积累到阈值后批量推理
    """

    def __init__(self) -> None:
        self._model: Optional["WhisperModel"] = None
        self._model_lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1)
        self._realtime_buffer: bytes = b""
        self._realtime_call_count: int = 0
        # 累积阈值：3秒 @ 16kHz 16bit mono ≈ 96 000 bytes
        self._realtime_threshold: int = 96_000

    # ------------------------------------------------------------------
    # 模型管理
    # ------------------------------------------------------------------

    def _get_model(self) -> "WhisperModel":
        """
        延迟初始化 WhisperModel 单例（双重检查锁，线程安全）。

        faster_whisper 放在函数内延迟导入，防止包未安装时模块级 import 失败。
        """
        if self._model is None:
            with self._model_lock:
                if self._model is None:
                    from faster_whisper import WhisperModel  # noqa: PLC0415

                    logger.info(
                        "WhisperModel 初始化",
                        model_size=settings.WHISPER_MODEL_SIZE,
                        model_dir=settings.WHISPER_MODEL_DIR,
                        device="cpu",
                        compute_type="int8",
                    )
                    self._model = WhisperModel(
                        settings.WHISPER_MODEL_SIZE,
                        download_root=settings.WHISPER_MODEL_DIR,
                        device="cpu",
                        compute_type="int8",  # CPU 推理用 int8：速度快、内存小
                    )
        return self._model

    # ------------------------------------------------------------------
    # 同步推理内核（在线程池执行）
    # ------------------------------------------------------------------

    def _transcribe_path(self, path: str, beam_size: int = 5) -> dict:
        """
        对磁盘文件执行 whisper 转录，返回统一响应格式。
        异常直接 re-raise，由调用方记录上下文后继续传播。
        """
        model = self._get_model()
        try:
            segments_iter, _info = model.transcribe(
                path,
                language="zh",
                beam_size=beam_size,
                word_timestamps=False,
            )
            segments = _ensure_nonempty(_build_segments(segments_iter))
        except Exception:
            logger.error("Whisper 推理失败", path=path)
            raise

        duration = segments[-1]["end_time"] + 500
        return {
            "status": "completed",
            "duration": duration,
            "segments": segments,
        }

    def _transcribe_bytes(self, file_content: bytes, filename: str, beam_size: int = 5) -> dict:
        """
        将字节写入临时文件，调用 _transcribe_path，最后删除临时文件。
        """
        suffix = (
            "." + filename.rsplit(".", 1)[-1].lower()
            if "." in filename
            else ".wav"
        )
        tmp_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(
                suffix=suffix, delete=False
            ) as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name
            return self._transcribe_path(tmp_path, beam_size=beam_size)
        except Exception:
            logger.error(
                "Whisper 转录失败（bytes）",
                filename=filename,
                size=len(file_content),
            )
            raise
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def _download_and_transcribe(self, audio_url: str) -> dict:
        """
        同步下载 URL 音频后调用 _transcribe_bytes。
        httpx 异常直接 re-raise。
        """
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(audio_url)
                response.raise_for_status()
        except httpx.HTTPError:
            logger.error("Whisper 下载音频失败", url=audio_url)
            raise

        # 从 URL 推断文件名（去掉 query string）
        filename = audio_url.split("/")[-1].split("?")[0] or "audio.wav"
        return self._transcribe_bytes(response.content, filename)

    # ------------------------------------------------------------------
    # 公开异步接口
    # ------------------------------------------------------------------

    async def recognize_file(
        self, file_content: bytes, filename: str = "audio"
    ) -> dict:
        """
        录音文件识别。

        将字节写入临时文件后调用 faster-whisper 推理。
        推理在线程池执行，不阻塞事件循环。
        """
        logger.info(
            "Whisper 录音文件识别",
            filename=filename,
            size=len(file_content),
        )
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self._executor, self._transcribe_bytes, file_content, filename
        )

    async def recognize_url(self, audio_url: str) -> dict:
        """
        URL 音频识别。

        先同步下载字节，再调用 faster-whisper 推理。
        下载 + 推理均在线程池执行。
        """
        logger.info("Whisper URL 音频识别", url=audio_url)
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self._executor, self._download_and_transcribe, audio_url
        )

    async def recognize_realtime(self, audio_chunk: bytes) -> dict:
        """
        实时语音识别（缓冲区积累策略）。

        - 每次调用将 audio_chunk 追加到内部缓冲区
        - 缓冲区未达阈值（< 96 000 bytes ≈ 3 秒）→ 返回 partial（空文本）
        - 缓冲区达阈值 → 清空缓冲区，触发推理 → 返回 final
        """
        self._realtime_buffer += audio_chunk
        self._realtime_call_count += 1

        if len(self._realtime_buffer) >= self._realtime_threshold:
            # 取出当前缓冲区并重置，防止推理期间新 chunk 混入旧批次
            buffer = self._realtime_buffer
            self._realtime_buffer = b""

            logger.info(
                "Whisper 实时识别触发",
                buffer_size=len(buffer),
                call_count=self._realtime_call_count,
            )
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                self._executor,
                lambda: self._transcribe_bytes(buffer, "audio.wav", beam_size=1),
            )

            segs = result["segments"]
            text = " ".join(s["text"] for s in segs) if segs else ""
            begin = segs[0]["begin_time"] if segs else 0
            end = segs[-1]["end_time"] if segs else 0
            return {
                "status": "final",
                "text": text,
                "is_final": True,
                "begin_time": begin,
                "end_time": end,
            }

        # 缓冲区未满，返回 partial（客户端继续发送音频帧）
        return {
            "status": "partial",
            "text": "",
            "is_final": False,
            "begin_time": 0,
            "end_time": 0,
        }


# ---------------------------------------------------------------------------
# 服务单例
# ---------------------------------------------------------------------------

whisper_asr_service = WhisperAsrService()
