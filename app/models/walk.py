import json
from decimal import Decimal


class Walk:
    def __init__(self, id, name, date, description, path_geojson, distance, co2_saved):
        self.id = id
        self.name = name
        self.date = date
        self.description = description
        self.path_geojson = path_geojson
        self.distance = distance
        self.co2_saved = co2_saved

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'date': self.date,
            'description': self.description,
            'path_geojson': self.path_geojson,
            'distance': self.distance,
            'co2_saved': self.co2_saved
        }

    @classmethod
    def from_postgres_row(cls, row):
        return cls(
            id=row[0],                            # id
            name=row[1],                          # name
            date=row[2],                          # date
            description=row[3],                   # description
            path_geojson=row[4],                  # path_geojson
            distance=float(Decimal(row[5])),      # distance
            co2_saved=float(Decimal(row[6]))      # co2_saved
        )

    @classmethod
    def from_db_row(cls, row):
        return cls(
            id=row[0],                            # id
            name=row[1],                          # name
            date=row[2],                          # date
            description=row[3],                   # description
            path_geojson=json.loads(row[4]),      # path_geojson
            distance=row[5],                      # distance
            co2_saved=row[6]                      # co2_saved
        )

    def __repr__(self):
        return (f"Walk(id={self.id}, descrioption={self.description}, name='{self.name}', date={self.date}, "
                f"distance={self.distance}, co2_saved={self.co2_saved})")
