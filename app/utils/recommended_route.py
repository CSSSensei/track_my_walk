import math
import random
from typing import List, Optional

from flask import Flask
from collections import defaultdict
from shapely.geometry import Polygon, Point

from app.extensions.postgres import PostgresDB
from app.models.route import Route
from app.utils.ors_requests import get_route, get_zigzag_route

MIN_LON = 37.3687
MAX_LON = 37.8426
MIN_LAT = 55.5698
MAX_LAT = 55.9112
mkad_coords = [
    [
        37.5955903429074,
        55.90768082203752
    ],
    [
        37.57636318537541,
        55.91165122503094
    ],
    [
        37.543980604269365,
        55.90824804735425
    ],
    [
        37.515645845801714,
        55.9008734710836
    ],
    [
        37.48326326469564,
        55.88839022437051
    ],
    [
        37.458976328866385,
        55.88157948779576
    ],
    [
        37.430641570398734,
        55.87760600621101
    ],
    [
        37.4144502798452,
        55.87022560424279
    ],
    [
        37.398258989292685,
        55.86114010676263
    ],
    [
        37.39421116665429,
        55.85375657515252
    ],
    [
        37.393199210994425,
        55.844099070422004
    ],
    [
        37.39421116665429,
        55.83443916585631
    ],
    [
        37.39421116665429,
        55.823639961590715
    ],
    [
        37.38611552137755,
        55.80715118428
    ],
    [
        37.37903183176067,
        55.792362202250644
    ],
    [
        37.3668883638465,
        55.78382754201948
    ],
    [
        37.36891227516517,
        55.76390606243129
    ],
    [
        37.37296009780357,
        55.747961546705
    ],
    [
        37.37498400912227,
        55.728591584927585
    ],
    [
        37.396235077973984,
        55.70693142610082
    ],
    [
        37.41951005814343,
        55.68126570079505
    ],
    [
        37.434689393037104,
        55.65615402939915
    ],
    [
        37.461000240185086,
        55.63445370603338
    ],
    [
        37.48225131038075,
        55.61331288052685
    ],
    [
        37.52953684582522,
        55.58671792609297
    ],
    [
        37.576374080221996,
        55.57570978514883
    ],
    [
        37.63000773017882,
        55.567127715139634
    ],
    [
        37.67756964617848,
        55.56941645051347
    ],
    [
        37.71501200558177,
        55.57742597411203
    ],
    [
        37.7859648602703,
        55.61118796497544
    ],
    [
        37.84425874025703,
        55.650316328171726
    ],
    [
        37.853350338471785,
        55.674248372855914
    ],
    [
        37.85702858677104,
        55.76296472562572
    ],
    [
        37.85278584093675,
        55.81442269744397
    ],
    [
        37.717958795269396,
        55.88696239618622
    ],
    [
        37.660984779787384,
        55.89715869139434
    ],
    [
        37.592442144561005,
        55.90882106557132
    ]
]
mkad_polygon = Polygon(mkad_coords)


def is_inside_mkad(point: list) -> bool:
    """Проверяет, находится ли точка внутри полигона МКАДа"""
    return mkad_polygon.contains(Point(point[0], point[1]))


def create_grid(cell_size_km: float = 1.0) -> dict:
    """Создает сетку квадратов 1x1 км внутри МКАД."""
    grid = defaultdict(int)
    cell_size_deg = cell_size_km / 111.32  # 1° ≈ 111.32 км

    lon_steps = int((MAX_LON - MIN_LON) / cell_size_deg)
    lat_steps = int((MAX_LAT - MIN_LAT) / cell_size_deg)

    return {
        "cell_size_deg": cell_size_deg,
        "lon_steps": lon_steps,
        "lat_steps": lat_steps,
        "grid": grid
    }


def update_grid_with_walks(grid_data: dict, walks: list) -> dict:
    """Обновляет сетку на основе истории прогулок."""
    cell_size = grid_data["cell_size_deg"]
    grid = grid_data["grid"]
    for walk in walks:
        for lon, lat in walk.path_geojson['coordinates']:
            x = int((lon - MIN_LON) / cell_size)
            y = int((lat - MIN_LAT) / cell_size)
            grid[(x, y)] += 1

    return grid_data


def find_least_visited_cells(grid_data: dict, top_n: int = 10) -> list:
    """Возвращает центры наименее посещенных квадратов ВНУТРИ полигона МКАДа."""
    grid = grid_data["grid"]
    cell_size = grid_data["cell_size_deg"]

    sorted_cells = sorted(grid.items(), key=lambda x: x[1])

    least_visited = []
    for (x, y), _ in sorted_cells:
        center = [
            MIN_LON + (x + 0.5) * cell_size,
            MIN_LAT + (y + 0.5) * cell_size
        ]

        if is_inside_mkad(center):
            least_visited.append(center)
            if len(least_visited) == top_n:
                break

    while len(least_visited) < top_n:
        random_point = [
            random.uniform(MIN_LON, MAX_LON),
            random.uniform(MIN_LAT, MAX_LAT)
        ]
        if is_inside_mkad(random_point):
            least_visited.append(random_point)

    return least_visited


def generate_route_from_cell(api_key: str,
                             cell_center: list,
                             time_minutes: int) -> Route:
    """Генерирует маршрут из центра квадрата."""
    target_distance = 1.4 * time_minutes * 60  # 1.4 м/с * время

    angle = random.uniform(0, 2 * math.pi)
    distance_deg = target_distance / 111320  # 1° ≈ 111.32 км

    end_point = [
        cell_center[0] + distance_deg * math.cos(angle),
        cell_center[1] + distance_deg * math.sin(angle)
    ]

    # Проверка, что конечная точка внутри МКАД
    if not (MIN_LON <= end_point[0] <= MAX_LON and MIN_LAT <= end_point[1] <= MAX_LAT):
        return None

    return get_route(api_key, cell_center, end_point)


def get_recommended_route(api_key: str,
                          time_minutes: int,
                          walks: list,
                          angle: int = 60,
                          segments: int = 10,
                          start_point: Optional[List[float]] = None) -> Optional[Route]:
    """Главная функция для получения рекомендации."""
    if start_point:
        route = generate_zigzag_route(api_key, start_point, time_minutes, angle, segments)
        if route:
            return route
    grid_data = create_grid()
    grid_data = update_grid_with_walks(grid_data, walks)

    target_cells = find_least_visited_cells(grid_data, top_n=5)

    for cell in target_cells:
        # route = generate_route_from_cell(api_key, cell, time_minutes)
        route = generate_zigzag_route(api_key, cell, time_minutes, angle, segments)
        if route:
            return route

    return None


def generate_zigzag_route(api_key: str,
                          start_point: List[float],
                          time_minutes: int,
                          anlge: int = 60,
                          segments: int = 5) -> Route:
    """
    Генерирует извилистый маршрут с случайными поворотами.

    Параметры:
        api_key: API ключ OpenRouteService
        start_point: Начальная точка [lon, lat]
        time_minutes: Желаемое время прогулки
        segments: Количество сегментов маршрута

    Возвращает:
        Route объект или None при ошибке
    """
    total_distance = 1.11 * time_minutes * 60
    segment_distance = total_distance / segments
    distance_deg = segment_distance / 111320  # Переводим в градусы

    current_point = start_point
    all_points = [start_point]

    for i in range(segments):
        # Генерируем случайный азимут (от -60° до +60° от предыдущего направления)
        if i == 0:
            angle = random.uniform(0, 2 * math.pi)  # Первое направление
        else:
            angle += math.radians(random.uniform(-anlge, anlge))

        next_point = [
            current_point[0] + distance_deg * math.cos(angle),
            current_point[1] + distance_deg * math.sin(angle)
        ]

        if not mkad_polygon.contains(Point(next_point[0], next_point[1])):
            # Если вышли за границы, отражаем угол
            angle += math.radians(180 + random.uniform(-30, 30))
            next_point = [
                current_point[0] + distance_deg * math.cos(angle),
                current_point[1] + distance_deg * math.sin(angle)
            ]

        all_points.append(next_point)
        current_point = next_point

    return get_zigzag_route(api_key, all_points)


if __name__ == '__main__':
    app = Flask(__name__)
    with app.app_context():
        db = PostgresDB()
        db.init_db()
        walks = db.get_walks()
        route = get_recommended_route(
            'api=',
            30,
            walks)
        print(route.path_geojson, route.duration / 60, sep='\n')
