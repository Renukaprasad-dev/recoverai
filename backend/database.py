from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"


# ============================================================
# SETTINGS
# ============================================================

class Settings(BaseSettings):
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str = "postgres"
    SQLALCHEMY_ECHO: bool = False

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()


# ============================================================
# DATABASE URL
# ============================================================

database_url = URL.create(
    drivername="postgresql+asyncpg",
    username=settings.DB_USER,
    password=settings.DB_PASSWORD,
    host=settings.DB_HOST,
    port=settings.DB_PORT,
    database=settings.DB_NAME,
)


# ============================================================
# ASYNC DATABASE ENGINE
# ============================================================

engine = create_async_engine(
    database_url,
    echo=settings.SQLALCHEMY_ECHO,
    pool_pre_ping=True,
    poolclass=NullPool,
)


# ============================================================
# SESSION FACTORY
# ============================================================

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ============================================================
# DATABASE DEPENDENCY
# ============================================================

async def get_db():
    async with SessionLocal() as session:
        yield session
