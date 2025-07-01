import json
from datetime import datetime, timedelta
import re
from typing import List, Optional, Dict, Any

from app.extensions.database import get_db_interface
from app.models.route import Route
from app.models.walk import Walk
from app.utils import distance
from app.utils.time_conversion import unix_time_to_readable


def parse_coordinates(coord_str: str) -> Optional[List[float]]:
    numbers = re.findall(r'[-+]?\d*\.\d+|\d+', coord_str)
    if len(numbers) != 2:
        return None
    # Google обычно хранит как 'lat, lon', GeoJSON - [lon, lat]
    return [float(numbers[1]), float(numbers[0])]


def parse_time(time_str: str) -> datetime:
    """
    Парсит строку времени ISO 8601 с учетом смещения UTC.
    Обрабатывает различные форматы миллисекунд и смещений (+HH:MM, +HHMM, Z).
    """
    # Удаляем миллисекунды для упрощения парсинга, если они есть
    time_str_parts = time_str.split('.')
    main_part = time_str_parts[0]

    offset = ''
    if len(time_str_parts) > 1:
        # Пытаемся обработать смещение, если оно есть после миллисекунд (e.g., +03:00)
        offset_part = time_str_parts[1].split('+', 1)  # Разделяем только один раз
        if len(offset_part) > 1:
            offset = '+' + offset_part[1]
            if ':' in offset:  # Удаляем двоеточие из смещения для %z
                offset = offset.replace(':', '')
        else:  # Случай, когда заканчивается на Z или нет смещения после мс
            if time_str.endswith('Z'):
                offset = 'Z'
            elif '-' in time_str_parts[1]:  # Случай, когда это -HH:MM или -HHMM
                offset = '-' + time_str_parts[1].split('-')[1]
                if ':' in offset:
                    offset = offset.replace(':', '')
            elif '+' in time_str_parts[1]:  # Случай, когда это +HH:MM или +HHMM
                offset = '+' + time_str_parts[1].split('+')[1]
                if ':' in offset:
                    offset = offset.replace(':', '')

    full_time_str_to_parse = main_part + offset if offset else main_part

    # Если смещение Z, то это UTC. Просто убираем Z, добавляем +0000 для парсера.
    if time_str.endswith('Z'):
        dt_object = datetime.strptime(time_str[:-1] + '+0000', "%Y-%m-%dT%H:%M:%S%z")
    else:
        # Пытаемся распарсить с учетом потенциального смещения типа +HH:MM или +HHMM
        try:
            dt_object = datetime.strptime(full_time_str_to_parse, "%Y-%m-%dT%H:%M:%S%z")
        except ValueError:
            # Если не получилось с %z, попробуем без смещения (это менее точно, но может потребоваться для кривых данных)
            # В этом случае часовой пояс будет потерян, и время будет наивным.
            # Для Timeline данных это рискованно, но может быть как запасной вариант.
            dt_object = datetime.strptime(main_part, "%Y-%m-%dT%H:%M:%S")

    return dt_object


def process_google_location_history(segments: List[Dict[str, Any]]) -> List[Route]:
    walk_routes: List[Route] = []

    # Соберем все точки из ВСЕХ сегментов timelinePath в один массив
    print("Собираем все точки из всех сегментов timelinePath...")
    all_global_timeline_points: List[Dict[str, Any]] = []
    for segment in segments:
        if 'timelinePath' in segment:
            for location in segment['timelinePath']:
                coords = parse_coordinates(location.get('point', ''))
                try:
                    point_time_dt = parse_time(location.get('time', ''))
                    if coords:
                        all_global_timeline_points.append({
                            'coords': coords,
                            'time_dt': point_time_dt
                        })
                except (ValueError, TypeError) as e:
                    print(f"Ошибка парсинга времени для точки маршрута: {e}. Пропускаем точку: {location.get('time')}")

    # Отсортируем все точки по времени
    all_global_timeline_points.sort(key=lambda x: x['time_dt'])

    print("Обрабатываем сегменты 'WALKING'...")
    for segment in segments:
        if 'activity' in segment and segment['activity'].get('topCandidate', {}).get('type') == 'WALKING':
            try:

                activity_start_dt = parse_time(segment.get('startTime'))
                activity_end_dt = parse_time(segment.get('endTime'))

                current_walk_path_geojson: List[List[float]] = []

                # Для каждого интервала WALKING активности, выбрать точки из all_global_timeline_points
                # Проходим по глобальному списку точек, ищем те, что входят в текущий интервал прогулки.
                # Используем оптимизацию для отсортированного списка (two-pointer approach)
                # (Хотя полный проход для каждого интервала тоже сработает, если интервалы могут сильно перекрываться)

                # Для упрощения и надежности, пройдемся по всем точкам для каждого интервала WALKING.
                # Это гарантирует, что мы не пропустим точки, даже если интервалы walking очень плотно расположены.
                for point_data in all_global_timeline_points:
                    if activity_start_dt <= point_data['time_dt'] <= activity_end_dt:
                        current_walk_path_geojson.append(point_data['coords'])

                # Добавляем маршрут, если в нем больше одной точки
                if len(current_walk_path_geojson) > 1:
                    walk_routes.append(Route(int(activity_start_dt.timestamp()), int(activity_end_dt.timestamp()), current_walk_path_geojson))

            except (ValueError, TypeError) as e:
                print(
                    f"Ошибка парсинга времени для сегмента активности: {e}. Пропускаем сегмент: {segment.get('startTime')} - {segment.get('endTime')}")

    return walk_routes


def import_walks_from_json(file) -> int:
    data = json.load(file)
    segments = data.get('semanticSegments', [])
    walk_routes: List[Route] = process_google_location_history(segments)

    for route_coords in walk_routes:
        # Create a GeoJSON LineString object
        geojson_path = {
            "type": "LineString",
            "coordinates": route_coords.path_geojson
        }

        walk_distance = 0
        for i in range(len(route_coords.path_geojson) - 1):
            p1_lon, p1_lat = route_coords.path_geojson[i]
            p2_lon, p2_lat = route_coords.path_geojson[i + 1]
            walk_distance += distance.calculate_distance_km(p1_lat, p1_lon, p2_lat, p2_lon)

        co2_saved = walk_distance * 0.15

        db_interface = get_db_interface()
        db_interface.add_walk(Walk(id=-1, name=f"Прогулка из Google Timeline ({unix_time_to_readable(route_coords.start_time)})",
                                   date=route_coords.start_time,
                                   description="Импортировано из Google Location History",
                                   path_geojson=json.dumps(geojson_path),
                                   distance=walk_distance,
                                   co2_saved=co2_saved))

    return len(walk_routes)


if __name__ == '__main__':
    print(int(parse_time('2025-06-22T18:42:24.000+03:00').timestamp()))
    print(parse_time('2025-06-22T18:42:24.000+03:00'))