from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from apps.api.app.core.config import get_settings
from db.models.base import Base

settings = get_settings()

connect_args: dict = {}
engine_kwargs: dict = {"pool_pre_ping": True}

if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine_kwargs = {}

engine = create_engine(settings.database_url, connect_args=connect_args, **engine_kwargs)

if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record) -> None:  # noqa: ARG001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
