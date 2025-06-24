from dataclasses import asdict, dataclass
from typing import List


@dataclass
class Route:
    start_time: str
    end_time: str
    path_geojson: List[List[float]]

    def to_dict(self):
        return asdict(self)
