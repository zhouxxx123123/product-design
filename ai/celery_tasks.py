"""
Celery application entry point.
Defines async tasks for audio transcription and insight extraction.
"""

from celery import Celery
import structlog

from core.config import settings

logger = structlog.get_logger(__name__)

celery = Celery(
    "liuguang",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Shanghai",
    enable_utc=True,
)


@celery.task(bind=True, max_retries=3, name="celery_tasks.transcribe_audio_file")
def transcribe_audio_file(self, file_url: str, session_id: str) -> dict:
    """
    Async task: Download audio from MinIO → ASR recognition → Write transcript to DB → Update session status.

    Args:
        file_url: MinIO object URL or path
        session_id: Interview session UUID

    Returns:
        dict with status, segments count, session_id
    """
    import asyncio
    from io import BytesIO

    logger.info("开始音频转录任务", file_url=file_url, session_id=session_id)

    try:
        # Download audio from MinIO
        from minio import Minio
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )

        # Extract object name from URL (format: bucket/object_name or just object_name)
        object_name = file_url.split(f"{settings.MINIO_BUCKET_NAME}/", 1)[-1] if settings.MINIO_BUCKET_NAME in file_url else file_url

        response = client.get_object(settings.MINIO_BUCKET_NAME, object_name)
        audio_bytes = response.read()
        response.close()
        response.release_conn()

        logger.info("音频文件下载完成", size=len(audio_bytes), session_id=session_id)

        # Run ASR recognition (sync wrapper around async)
        from services.asr import asr_service
        filename = object_name.split("/")[-1]
        result = asyncio.run(asr_service.recognize_file(audio_bytes, filename))

        segments = result.get("segments", [])
        logger.info("ASR识别完成", segments_count=len(segments), session_id=session_id)

        # Write transcript segments to database via sqlalchemy sync
        import sqlalchemy as sa
        engine = sa.create_engine(
            settings.DATABASE_URL.replace("+asyncpg", ""),
            pool_pre_ping=True,
        )
        with engine.begin() as conn:
            for i, seg in enumerate(segments):
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO transcription_segments
                            (id, session_id, text, start_ms, end_ms, speaker, "order", created_at, updated_at)
                        VALUES
                            (gen_random_uuid(), :session_id, :text, :start_ms, :end_ms, :speaker, :order, NOW(), NOW())
                        ON CONFLICT DO NOTHING
                        """
                    ),
                    {
                        "session_id": session_id,
                        "text": seg.get("text", ""),
                        "start_ms": seg.get("begin_time", 0),
                        "end_ms": seg.get("end_time", 0),
                        "speaker": f"说话人{seg.get('speaker_tag', 0) + 1}",
                        "order": i,
                    },
                )
            # Update session status to 'completed'
            conn.execute(
                sa.text(
                    "UPDATE interview_sessions SET status = 'completed', updated_at = NOW() WHERE id = :session_id"
                ),
                {"session_id": session_id},
            )

        logger.info("转录任务完成", session_id=session_id, segments_count=len(segments))
        return {"status": "completed", "session_id": session_id, "segments_count": len(segments)}

    except Exception as exc:
        logger.error("转录任务失败", session_id=session_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery.task(bind=True, max_retries=3, name="celery_tasks.extract_insights_async")
def extract_insights_async(self, session_id: str, transcript: str) -> dict:
    """
    Async task: Call LLM to extract structured insights → Write to insights table.

    Args:
        session_id: Interview session UUID
        transcript: Full transcript text

    Returns:
        dict with status, insights count, session_id
    """
    import asyncio

    logger.info("开始洞察提取任务", session_id=session_id, transcript_length=len(transcript))

    try:
        # Call LLM for insight extraction
        from services.llm import llm_service

        system_prompt = (
            "你是一名专业的商业调研分析师。根据访谈转录文本，提取关键商业洞察。"
            "请以JSON格式返回，格式：{\"insights\": [{\"layer\": 1|2|3, \"title\": \"...\", \"content\": \"...\", \"department\": \"...\"}]}"
            "layer 1=原始摘录, layer 2=结构化洞察, layer 3=执行摘要"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"访谈转录：\n{transcript[:8000]}"},
        ]

        response_data = asyncio.run(llm_service.chat(messages=messages))
        raw_content = response_data["choices"][0]["message"]["content"]

        # Parse JSON
        import json
        import re
        cleaned = re.sub(r"```(?:json)?\s*([\s\S]*?)```", r"\1", raw_content.strip()).strip()
        try:
            parsed = json.loads(cleaned)
            insights_list = parsed.get("insights", [])
        except (json.JSONDecodeError, ValueError):
            logger.warning("洞察JSON解析失败，使用原始文本", session_id=session_id)
            insights_list = [{"layer": 3, "title": "访谈摘要", "content": raw_content[:2000], "department": "综合"}]

        # Write insights to database
        import sqlalchemy as sa
        engine = sa.create_engine(
            settings.DATABASE_URL.replace("+asyncpg", ""),
            pool_pre_ping=True,
        )
        with engine.begin() as conn:
            for insight in insights_list:
                content_json = json.dumps({
                    "title": insight.get("title", ""),
                    "text": insight.get("content", ""),
                    "department": insight.get("department", ""),
                }, ensure_ascii=False)
                conn.execute(
                    sa.text(
                        """
                        INSERT INTO insights
                            (id, session_id, layer, content, created_at, updated_at)
                        VALUES
                            (gen_random_uuid(), :session_id, :layer, :content::jsonb, NOW(), NOW())
                        """
                    ),
                    {
                        "session_id": session_id,
                        "layer": insight.get("layer", 2),
                        "content": content_json,
                    },
                )

        logger.info("洞察提取任务完成", session_id=session_id, insights_count=len(insights_list))
        return {"status": "completed", "session_id": session_id, "insights_count": len(insights_list)}

    except Exception as exc:
        logger.error("洞察提取任务失败", session_id=session_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)
