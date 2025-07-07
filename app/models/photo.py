from dataclasses import dataclass
from decimal import Decimal


@dataclass
class Photo:
    id: int
    walk_id: int
    url: str
    description: str
    latitude: float
    longitude: float
    thumbnail_url: str

    @classmethod
    def from_postgres_row(cls, row):
        return cls(
            id=row[0],                            # id
            walk_id=row[1],                       # walk_id
            url=row[2],                           # url
            description=row[3],                   # description
            latitude=float(Decimal(row[4])),      # latitude
            longitude=float(Decimal(row[5])),     # longitude
            thumbnail_url=row[6]                  # thumbnail_url
        )
