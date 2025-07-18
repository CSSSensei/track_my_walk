from dataclasses import asdict, dataclass
from typing import List


@dataclass
class Route:
    duration: float
    distance: float
    path_geojson: List[List[float]]
    link: str

    def to_dict(self):
        return asdict(self)
