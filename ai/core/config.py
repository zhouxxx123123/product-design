"""
应用配置
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""

    model_config = SettingsConfigDict(
        # 加载顺序：根目录变量 → 服务本地覆盖（后者优先）
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 应用信息
    APP_NAME: str = "中科琉光AI服务"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # 服务器配置
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS配置
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:4000",
        "http://backend:4000",  # Docker network alias
    ]

    # 数据库配置
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/liuguang"
    DATABASE_POOL_SIZE: int = 10

    # Redis配置
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_POOL_SIZE: int = 10

    # 对象存储配置 (MinIO)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "liuguang"
    MINIO_SECURE: bool = False

    # ASR 提供商选择：whisper | tencent | mock
    ASR_PROVIDER: str = "whisper"

    # ASR 模式选择：mock | real | auto
    ASR_MODE: str = "auto"

    # faster-whisper 本地模型配置
    WHISPER_MODEL_SIZE: str = "small"        # tiny | base | small | medium | large
    WHISPER_MODEL_DIR: str = "/opt/models/whisper"

    # 腾讯ASR配置
    TENCENT_SECRET_ID: str = ""
    TENCENT_SECRET_KEY: str = ""
    TENCENT_REGION: str = "ap-beijing"

    # Kimi (Moonshot AI) 配置
    MOONSHOT_API_KEY: str = ""
    MOONSHOT_BASE_URL: str = "https://api.moonshot.cn/v1"
    MOONSHOT_MODEL: str = "kimi-k2.5"

    # JWT配置（与 NestJS 后端共享同一密钥）
    JWT_SECRET: str = ""

    # Celery配置
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    @property
    def cors_origins_list(self) -> List[str]:
        """获取CORS来源列表"""
        if isinstance(self.CORS_ORIGINS, str):
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
        return self.CORS_ORIGINS


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


settings = get_settings()
