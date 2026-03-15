"""
腾讯云语音识别服务
- 已配置 TENCENT_SECRET_ID / TENCENT_SECRET_KEY → 调用真实 SentenceRecognition API
- 未配置 → 自动 fallback mock，仅打印 warning，不抛异常
"""

import asyncio
import base64
import hashlib
from typing import Optional

import structlog
from tencentcloud.asr.v20190614 import asr_client, models
from tencentcloud.common import credential
from tencentcloud.common.exception.tencent_cloud_sdk_exception import (
    TencentCloudSDKException,
)

from core.config import settings

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Mock transcript data — enterprise interview scenario (cross-border payments)
# ---------------------------------------------------------------------------

_MOCK_SEGMENTS_SCENARIO_A = [
    {"text": "张总您好，感谢您抽出时间参加今天的访谈。我们想了解一下贵公司在跨境支付方面的现状和痛点。", "begin_time": 500, "end_time": 3800, "speaker_tag": 0, "confidence": 0.98},
    {"text": "不客气。目前我们最大的困扰是合规审核周期太长，一笔跨境汇款平均要等3到5个工作日。", "begin_time": 4200, "end_time": 8600, "speaker_tag": 1, "confidence": 0.97},
    {"text": "3到5天确实比较长。能具体说说主要卡在哪些环节吗？", "begin_time": 9000, "end_time": 11500, "speaker_tag": 0, "confidence": 0.99},
    {"text": "主要是不同国家的监管要求不一样，我们的财务团队需要逐一核对，很容易出错。", "begin_time": 12000, "end_time": 16800, "speaker_tag": 1, "confidence": 0.96},
    {"text": "明白。那目前有没有考虑过自动化解决方案？", "begin_time": 17200, "end_time": 19400, "speaker_tag": 0, "confidence": 0.98},
    {"text": "有考虑过，但担心自动化后合规风险不可控。毕竟各国的政策经常变化。", "begin_time": 19800, "end_time": 24200, "speaker_tag": 1, "confidence": 0.95},
    {"text": "这个顾虑很有代表性。能讲讲最近一次因为审核延误导致的具体损失吗？", "begin_time": 24600, "end_time": 28000, "speaker_tag": 0, "confidence": 0.97},
    {"text": "上个季度有一笔500万美元的货款，因为合规审核卡了整整6天，导致供应商那边加收了滞纳金，损失大概8万块。", "begin_time": 28400, "end_time": 35000, "speaker_tag": 1, "confidence": 0.94},
    {"text": "8万的直接损失，加上隐性的机会成本，数字就更大了。贵公司每个月大概有多少笔跨境汇款？", "begin_time": 35400, "end_time": 40200, "speaker_tag": 0, "confidence": 0.98},
    {"text": "平均每月60到80笔，涉及12个国家和地区，金额从几十万到几百万不等。", "begin_time": 40600, "end_time": 46000, "speaker_tag": 1, "confidence": 0.96},
    {"text": "规模相当可观。如果能将审核周期压缩到24小时以内，您觉得对业务有多大帮助？", "begin_time": 46400, "end_time": 51000, "speaker_tag": 0, "confidence": 0.99},
    {"text": "那会是革命性的变化。资金周转率至少能提升30%，财务团队也可以从繁琐的手工核对中解放出来。", "begin_time": 51400, "end_time": 57200, "speaker_tag": 1, "confidence": 0.95},
    {"text": "非常感谢张总的详细分享。我们下一步会针对这些场景设计方案给您评估。", "begin_time": 57600, "end_time": 62000, "speaker_tag": 0, "confidence": 0.98},
    {"text": "好的，期待看到具体方案。", "begin_time": 62400, "end_time": 64500, "speaker_tag": 1, "confidence": 0.99},
]

_MOCK_SEGMENTS_SCENARIO_B = [
    {"text": "王总，今天主要想聊聊您在供应链金融方面的需求。", "begin_time": 600, "end_time": 3200, "speaker_tag": 0, "confidence": 0.97},
    {"text": "对，我们现在最头疼的是账期问题，上游供应商要求30天付款，但我们的下游客户要90天才回款。", "begin_time": 3600, "end_time": 9000, "speaker_tag": 1, "confidence": 0.96},
    {"text": "60天的资金缺口，这对现金流压力很大。目前是怎么解决的？", "begin_time": 9400, "end_time": 12800, "speaker_tag": 0, "confidence": 0.98},
    {"text": "主要靠银行信贷，但审批时间长，而且抵押要求高，中小企业很难达标。", "begin_time": 13200, "end_time": 18400, "speaker_tag": 1, "confidence": 0.95},
    {"text": "如果有一种基于订单数据的快速融资产品，审批时间在48小时以内，您觉得可行吗？", "begin_time": 18800, "end_time": 23600, "speaker_tag": 0, "confidence": 0.97},
    {"text": "这个很有吸引力。关键是利率要合理，不能比银行高太多。", "begin_time": 24000, "end_time": 27800, "speaker_tag": 1, "confidence": 0.96},
    {"text": "理解。能接受的利率上限大概在什么范围？", "begin_time": 28200, "end_time": 30400, "speaker_tag": 0, "confidence": 0.99},
    {"text": "年化10%以内比较合理，超过12%就不划算了。", "begin_time": 30800, "end_time": 34200, "speaker_tag": 1, "confidence": 0.97},
    {"text": "明白。除了融资之外，对账和对单的效率问题也是痛点吗？", "begin_time": 34600, "end_time": 38400, "speaker_tag": 0, "confidence": 0.98},
    {"text": "非常痛。我们每个月要手工核对几百张发票，财务部门要加班加点才能对清楚。", "begin_time": 38800, "end_time": 44000, "speaker_tag": 1, "confidence": 0.94},
    {"text": "如果对账自动化，您的财务团队估计能节省多少工时？", "begin_time": 44400, "end_time": 47800, "speaker_tag": 0, "confidence": 0.98},
    {"text": "保守估计每月节省200小时，相当于省出了一个财务专员的人力成本。", "begin_time": 48200, "end_time": 53400, "speaker_tag": 1, "confidence": 0.96},
]

# ---------------------------------------------------------------------------
# 音频格式映射（腾讯 ASR 支持的扩展名 → VoiceFormat 字符串）
# ---------------------------------------------------------------------------

_VOICE_FORMAT_MAP: dict[str, str] = {
    "wav": "wav",
    "mp3": "mp3",
    "m4a": "m4a",
    "aac": "aac",
    "pcm": "pcm",
}


# ---------------------------------------------------------------------------
# 模块级纯函数（独立可测）
# ---------------------------------------------------------------------------


def _get_voice_format(filename: str) -> str:
    """从文件名推断腾讯 ASR VoiceFormat；不支持的扩展名默认返回 'wav'。"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return _VOICE_FORMAT_MAP.get(ext, "wav")


def _split_by_speaker(word_list, full_text: str) -> list[dict]:
    """
    按 SpeakerTag 变化将 WordList 切割为 segments。

    word_list: 腾讯 SentenceRecognitionResponse.WordList（对象列表，含 Word/StartTime/EndTime/SpeakerTag 属性）
    full_text: 整体识别文字，作为 word_list 为空时的兜底。
    """
    if not word_list:
        return [
            {
                "text": full_text,
                "begin_time": 0,
                "end_time": 0,
                "speaker_tag": 0,
                "confidence": 1.0,
            }
        ]

    segments: list[dict] = []
    current_words: list[str] = []
    current_speaker: int = word_list[0].SpeakerTag
    current_begin: int = word_list[0].StartTime
    current_end: int = word_list[0].EndTime

    for word_item in word_list:
        speaker = word_item.SpeakerTag
        if speaker != current_speaker:
            # 切割：保存当前 segment
            segments.append(
                {
                    "text": "".join(current_words),
                    "begin_time": current_begin,
                    "end_time": current_end,
                    "speaker_tag": current_speaker,
                    "confidence": 1.0,
                }
            )
            # 开启新 segment
            current_words = [word_item.Word]
            current_speaker = speaker
            current_begin = word_item.StartTime
            current_end = word_item.EndTime
        else:
            current_words.append(word_item.Word)
            current_end = word_item.EndTime

    # 收尾最后一组
    if current_words:
        segments.append(
            {
                "text": "".join(current_words),
                "begin_time": current_begin,
                "end_time": current_end,
                "speaker_tag": current_speaker,
                "confidence": 1.0,
            }
        )

    return segments


def _build_response(resp) -> dict:
    """
    将 SentenceRecognitionResponse 转换为统一响应格式。

    resp: tencentcloud SentenceRecognitionResponse 对象
    """
    full_text: str = resp.Result or ""
    segments = _split_by_speaker(resp.WordList, full_text)
    duration: int = segments[-1]["end_time"] + 500 if segments else 0
    return {
        "status": "completed",
        "duration": duration,
        "segments": segments,
    }


# ---------------------------------------------------------------------------
# Mock 纯函数（供 fallback 调用，与 class 解耦，便于独立测试）
# ---------------------------------------------------------------------------


def _mock_recognize_file(file_content: bytes) -> dict:
    """按文件大小奇偶选择 mock 场景。"""
    segments = (
        _MOCK_SEGMENTS_SCENARIO_A
        if len(file_content) % 2 == 0
        else _MOCK_SEGMENTS_SCENARIO_B
    )
    total_duration = segments[-1]["end_time"] + 500 if segments else 0
    return {
        "status": "completed",
        "duration": total_duration,
        "segments": list(segments),
    }


def _mock_recognize_url(audio_url: str) -> dict:
    """按 URL hash 奇偶选择 mock 场景。"""
    url_hash = int(hashlib.md5(audio_url.encode()).hexdigest(), 16)
    segments = (
        _MOCK_SEGMENTS_SCENARIO_A
        if url_hash % 2 == 0
        else _MOCK_SEGMENTS_SCENARIO_B
    )
    total_duration = segments[-1]["end_time"] + 500 if segments else 0
    return {
        "status": "completed",
        "duration": total_duration,
        "segments": list(segments),
    }


# ---------------------------------------------------------------------------
# 服务类
# ---------------------------------------------------------------------------


class TencentASRService:
    """
    腾讯云语音识别服务。
    - 已配置密钥 → 调用真实 SentenceRecognition API（一句话识别，含说话人分离）
    - 未配置密钥 → 自动 fallback mock，打印 warning，不抛异常
    """

    def __init__(self) -> None:
        self.secret_id: str = settings.TENCENT_SECRET_ID
        self.secret_key: str = settings.TENCENT_SECRET_KEY
        self.region: str = settings.TENCENT_REGION
        self._client: Optional[asr_client.AsrClient] = None
        # Realtime call counter per instance (for partial/final alternation)
        self._realtime_call_count: int = 0

    @property
    def _is_configured(self) -> bool:
        mode = settings.ASR_MODE.lower()
        if mode == "mock":
            return False
        if mode == "real":
            if not (self.secret_id and self.secret_key):
                raise RuntimeError(
                    "ASR_MODE=real 但 TENCENT_SECRET_ID/TENCENT_SECRET_KEY 未配置"
                )
            return True
        # auto mode: use real if available
        return bool(self.secret_id and self.secret_key)

    def _get_client(self) -> asr_client.AsrClient:
        """延迟初始化 SDK client（单例）。"""
        if self._client is None:
            cred = credential.Credential(self.secret_id, self.secret_key)
            self._client = asr_client.AsrClient(cred, self.region)
        return self._client

    def _call_sentence_recognition(
        self,
        audio_bytes: Optional[bytes],
        voice_format: str,
        audio_url: Optional[str],
    ):
        """
        同步调用腾讯云 SentenceRecognition，支持字节流或 URL 两种输入。
        """
        req = models.SentenceRecognitionRequest()
        req.EngSerViceType = "16k_zh"
        req.SpeakerDiarization = 1
        req.SpeakerNumber = 2

        if audio_bytes is not None:
            req.SourceType = 1  # 语音数据（base64）
            req.VoiceFormat = voice_format
            req.Data = base64.b64encode(audio_bytes).decode()
            req.DataLen = len(audio_bytes)
        else:
            req.SourceType = 0  # URL
            req.Url = audio_url

        return self._get_client().SentenceRecognition(req)

    # ------------------------------------------------------------------
    # 公开方法
    # ------------------------------------------------------------------

    async def recognize_file(
        self, file_content: bytes, filename: str = "audio"
    ) -> dict:
        """
        录音文件识别。
        - 已配置密钥 → 真实 API（SentenceRecognition，SourceType=1）
        - 未配置 → fallback mock
        """
        if not self._is_configured:
            logger.warning(
                "TENCENT_SECRET_ID 未配置，使用 mock 数据",
                method="recognize_file",
                filename=filename,
            )
            return _mock_recognize_file(file_content)

        return await self._recognize_file_real(file_content, filename)

    async def _recognize_file_real(
        self, file_content: bytes, filename: str
    ) -> dict:
        """调用真实 API 识别本地文件字节流。"""
        voice_format = _get_voice_format(filename)
        logger.info(
            "ASR real: 录音文件识别",
            filename=filename,
            size=len(file_content),
            voice_format=voice_format,
        )
        try:
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(
                None,
                self._call_sentence_recognition,
                file_content,
                voice_format,
                None,
            )
        except TencentCloudSDKException as exc:
            logger.error(
                "ASR SentenceRecognition 失败（file）",
                error=str(exc),
                filename=filename,
            )
            raise

        return _build_response(resp)

    async def recognize_url(self, audio_url: str) -> dict:
        """
        URL 音频文件识别。
        - 已配置密钥 → 真实 API（SentenceRecognition，SourceType=0）
        - 未配置 → fallback mock
        """
        if not self._is_configured:
            logger.warning(
                "TENCENT_SECRET_ID 未配置，使用 mock 数据",
                method="recognize_url",
                url=audio_url,
            )
            return _mock_recognize_url(audio_url)

        return await self._recognize_url_real(audio_url)

    async def _recognize_url_real(self, audio_url: str) -> dict:
        """调用真实 API 识别远程 URL 音频。"""
        logger.info("ASR real: URL音频识别", url=audio_url)
        try:
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(
                None,
                self._call_sentence_recognition,
                None,
                "wav",   # URL 模式下 VoiceFormat 由腾讯自动推断，传 wav 作占位
                audio_url,
            )
        except TencentCloudSDKException as exc:
            logger.error(
                "ASR SentenceRecognition 失败（url）",
                error=str(exc),
                url=audio_url,
            )
            raise

        return _build_response(resp)

    async def recognize_realtime(self, audio_chunk: bytes) -> dict:
        """
        实时语音识别（P2，当前保持 mock）。
        交替返回 partial / final 结果，模拟真实流式识别行为。
        """
        logger.info("ASR mock: 实时识别", chunk_size=len(audio_chunk))

        idx = self._realtime_call_count % len(_MOCK_SEGMENTS_SCENARIO_A)
        self._realtime_call_count += 1
        segment = _MOCK_SEGMENTS_SCENARIO_A[idx]
        is_final = self._realtime_call_count % 3 == 0

        return {
            "status": "final" if is_final else "partial",
            "text": segment["text"],
            "is_final": is_final,
            "begin_time": segment["begin_time"],
            "end_time": segment["end_time"],
        }


# ---------------------------------------------------------------------------
# 工厂函数：根据 ASR_PROVIDER 配置选择实现
# ---------------------------------------------------------------------------


def _create_asr_service():
    """
    根据 settings.ASR_PROVIDER 返回对应的 ASR 服务实例。

    whisper  → WhisperAsrService（本地 faster-whisper，无需 API Key）
    tencent  → TencentASRService（腾讯云 SentenceRecognition，需密钥）
    mock     → TencentASRService（密钥为空时自动 fallback mock）
    """
    provider = settings.ASR_PROVIDER.lower()
    if provider == "whisper":
        from services.asr_whisper import WhisperAsrService
        logger.info("ASR provider: faster-whisper（本地模型）", model_size=settings.WHISPER_MODEL_SIZE)
        return WhisperAsrService()
    elif provider == "tencent":
        logger.info("ASR provider: 腾讯云 SentenceRecognition")
        return TencentASRService()
    else:
        # mock 或未知值 → 用 TencentASRService（密钥为空时自动 fallback mock）
        logger.info("ASR provider: mock（硬编码场景数据）")
        return TencentASRService()


# 服务单例
asr_service = _create_asr_service()
