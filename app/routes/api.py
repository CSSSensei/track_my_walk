import json
from typing import List

from flask import Blueprint, request, jsonify, current_app
from ..extensions import database
from app.utils import walk_processing, distance
from ..models.route import Route
from app.utils import time_conversion

bp = Blueprint('api', __name__, url_prefix='/api')  # API routes prefixed with /api


@bp.route('/upload_location_history', methods=['POST'])
def upload_location_history():
    # Check API-key from config
    auth_header = request.headers.get('X-API-Key')
    if not auth_header or auth_header != current_app.config['API_KEY']:
        return jsonify({'error': 'Unauthorized: Invalid or missing API Key'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        try:
            data = json.load(file)
            segments = data.get('semanticSegments', [])
            walk_routes: List[Route] = walk_processing.process_google_location_history(segments)

            db = database.get_db()
            cursor = db.cursor()

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

                cursor.execute(
                    'INSERT INTO walks (name, date, description, path_geojson, distance, co2_saved) VALUES (?, ?, ?, ?, ?, ?)',
                    (f"Прогулка из Google Timeline ({time_conversion.unix_time_to_readable(route_coords.start_time)})", route_coords.start_time, "Импортировано из Google Location History",
                     json.dumps(geojson_path), walk_distance, co2_saved)
                )
            db.commit()
            return jsonify({'message': f'Successfully processed {len(walk_routes)} potential walks.'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
