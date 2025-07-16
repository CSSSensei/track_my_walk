from typing import List

import requests
from app.models.route import Route


def get_route(api_key, start_coords, end_coords):
    headers = {
        "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8"
    }

    url = f'https://api.openrouteservice.org/v2/directions/foot-walking?api_key={api_key}&start={start_coords[0]},{start_coords[1]}&end={end_coords[0]},{end_coords[1]}'
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        route_data = response.json()
        return Route(route_data['features'][0]['properties']['segments'][0]['duration'],
                     route_data['features'][0]['properties']['segments'][0]['distance'], route_data["features"][0]["geometry"]["coordinates"])
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе маршрута: {e}")
        return None


def get_zigzag_route(api_key, coords):
    try:
        body = {"coordinates": coords}

        headers = {
            'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
            'Authorization': api_key,
            'Content-Type': 'application/json; charset=utf-8'
        }
        response = requests.post('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', json=body, headers=headers)
        response.raise_for_status()
        route_data = response.json()
        time = 0
        distance = 0
        for segment in route_data['features'][0]['properties']['segments']:
            time += segment['duration']
        for segment in route_data['features'][0]['properties']['segments']:
            distance += segment['distance']
        return Route(time, distance, route_data["features"][0]["geometry"]["coordinates"], generate_yandex_link(coords))
    except requests.exceptions.RequestException as e:
        print(f"Ошибка при запросе маршрута: {e}")
        return None


def generate_yandex_link(coords: List[List[float]]) -> str:
    if not coords:
        return 'https://yan-toples.ru'
    link = 'https://yandex.com/maps?rtext='
    for point in coords:
        link += f'{point[1]}%2C{point[0]}~'
    link = link[:-1] + '&rtt=pd'
    return link


if __name__ == "__main__":
    API_KEY = "api"
    start_point = (37.47911122670405, 55.74693078360812)
    end_point = (37.54971824611425, 55.80847032645789)

    route_data = get_route(API_KEY, start_point, end_point)
    print(route_data)
    print(get_zigzag_route(API_KEY, [[8.681495, 49.41461], [8.686507, 49.41943], [8.687872, 49.420318]]).path_geojson)
