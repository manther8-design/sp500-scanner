from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class DataMetaOut(BaseModel):
    source: str
    as_of: datetime | None = None
    ingested_at: datetime | None = None
    is_delayed: bool = True
    completeness: float | None = None
    quality_flag: str | None = None
    unavailable_fields: list[str] = []
