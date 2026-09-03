import asyncio

try:
    from backend.database import engine
    from backend.models import Base
except ModuleNotFoundError:
    from database import engine
    from models import Base


async def create_tables():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    print("✅ RecoverAI database tables created successfully.")


if __name__ == "__main__":
    asyncio.run(create_tables())
