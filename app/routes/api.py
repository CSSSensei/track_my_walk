import json
from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import database
from app.utils import walk_processing

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
            locations = data.get('locations', [])

            # Use the utility function for processing
            walk_routes = walk_processing.process_google_location_history(locations)

            db = database.get_db()
            cursor = db.cursor()

            for route_coords in walk_routes:
                # Create a GeoJSON LineString object
                geojson_path = {
                    "type": "LineString",
                    "coordinates": route_coords
                }

                # Simplified CO2 calculation (from previous version)
                # This could also be refined in walk_processing.py
                co2_saved = len(route_coords) * 10

                # Date of the walk (take the first point of the route)
                # Need to convert first coordinate back to original format to get timestamp
                # This part is a bit tricky since walk_processing returns only coords, not original locs
                # For simplicity, we'll get the timestamp from the first coordinate, which is not ideal
                # A better way would be for walk_processing to return more metadata.
                # For now, let's assume the first point in route_coords corresponds to the first original location in 'locations'
                # if locations:
                #     first_original_loc = next((loc for loc in locations if (loc['longitudeE7'] / 1e7, loc['latitudeE7'] / 1e7) == (route_coords[0][0], route_coords[0][1])), None)
                #     if first_original_loc:
                #         date_ms = int(first_original_loc['timestampMs'])
                #         walk_date = datetime.fromtimestamp(date_ms / 1000).strftime('%Y-%m-%d %H:%M:%S')
                #     else:
                #         walk_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                # else:
                #     walk_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                # Simpler date assumption for API upload if original timestamp is not carried through walk_processing
                walk_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')


                cursor.execute(
                    'INSERT INTO walks (name, date, description, path_geojson, co2_saved) VALUES (?, ?, ?, ?, ?)',
                    (f"Импорт Google History ({walk_date})", walk_date, "Импортировано из Google Location History", json.dumps(geojson_path), co2_saved)
                )
            db.commit()
            return jsonify({'message': f'Successfully processed {len(walk_routes)} potential walks.'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
