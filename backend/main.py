from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.database import engine
from backend.webhooks import router as webhook_router
from backend.recovery import router as recovery_router
from backend.analytics import router as analytics_router


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="RecoverAI API",
    description="Autonomous Revenue Recovery System",
    version="0.1.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://recoverai-taupe.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROUTERS
# ============================================================

app.include_router(webhook_router)
app.include_router(recovery_router)
app.include_router(analytics_router)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():
    return {
        "message": "RecoverAI Backend is running!",
        "status": "online",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health():
    try:
        async with engine.connect() as connection:
            result = await connection.execute(
                text("SELECT 1")
            )

            value = result.scalar()

        return {
            "status": "healthy",
            "database": "connected",
            "test": value,
        }

    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "connection_failed",
            "error": str(e),
        }