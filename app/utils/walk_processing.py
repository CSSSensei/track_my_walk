# app/utils/walk_processing.py
from datetime import datetime


def process_google_location_history(locations):
    walk_routes = []
    current_route = []

    if locations:
        # GeoJSON coordinates are [longitude, latitude]
        current_route.append([locations[0]['longitudeE7'] / 1e7, locations[0]['latitudeE7'] / 1e7])

        for i in range(1, len(locations)):
            prev_loc = locations[i - 1]
            curr_loc = locations[i]

            time_diff = (int(curr_loc['timestampMs']) - int(prev_loc['timestampMs'])) / 1000 / 60

            if time_diff < 5:
                current_route.append([curr_loc['longitudeE7'] / 1e7, curr_loc['latitudeE7'] / 1e7])
            else:
                if len(current_route) > 1:  # Route must consist of at least 2 points
                    walk_routes.append(current_route)
                current_route = [[curr_loc['longitudeE7'] / 1e7, curr_loc['latitudeE7'] / 1e7]]

        if len(current_route) > 1:
            walk_routes.append(current_route)

    return walk_routes
