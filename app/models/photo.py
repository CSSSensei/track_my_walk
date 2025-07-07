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

    @classmethod
    def from_postgres_row(cls, row):
        return cls(
            id=row[0],                            # id
            walk_id=row[1],                          # name
            url=row[2],                          # date
            description=row[3],                   # description
            latitude=float(Decimal(row[4])),                  # path_geojson
            longitude=float(Decimal(row[5])),      # distance
        )
