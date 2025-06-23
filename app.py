import json
from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)
DATABASE = 'walks.db'


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS walks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                date TEXT,
                description TEXT,
                path_geojson TEXT, -- Storing as GeoJSON LineString string
                co2_saved REAL
            )
        ''')
        db.commit()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/walks', methods=['GET'])
def get_walks():
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks ORDER BY date DESC')
    walks = cursor.fetchall()
    return jsonify([dict(walk) for walk in walks])


@app.route('/upload_location_history', methods=['POST'])
def upload_location_history():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        try:
            data = json.load(file)
            locations = data.get('locations', [])

            walk_routes = []
            current_route = []

            if locations:
                # GeoJSON coordinates are [longitude, latitude]
                current_route.append([locations[0]['longitudeE7'] / 1e7, locations[0]['latitudeE7'] / 1e7])

                for i in range(1, len(locations)):
                    prev_loc = locations[i - 1]
                    curr_loc = locations[i]

                    time_diff = (int(curr_loc['timestampMs']) - int(prev_loc['timestampMs'])) / 1000 / 60  # in minutes

                    if time_diff < 5:  # If points are close in time
                        current_route.append([curr_loc['longitudeE7'] / 1e7, curr_loc['latitudeE7'] / 1e7])
                    else:
                        if len(current_route) > 1:  # Route must consist of at least 2 points
                            walk_routes.append(current_route)
                        current_route = [[curr_loc['longitudeE7'] / 1e7, curr_loc['latitudeE7'] / 1e7]]

                if len(current_route) > 1:
                    walk_routes.append(current_route)

            db = get_db()
            cursor = db.cursor()
            print(walk_routes)
            for route_coords in walk_routes:
                # Create a GeoJSON LineString object
                geojson_path = {
                    "type": "LineString",
                    "coordinates": route_coords
                }

                co2_saved = len(route_coords) * 10  # Simplified CO2 calculation

                # Date of the walk (take the first point of the route)
                # Need to convert first coordinate back to original format to get timestamp
                first_original_loc = next((loc for loc in locations if
                                           (loc['longitudeE7'] / 1e7, loc['latitudeE7'] / 1e7) == (route_coords[0][0], route_coords[0][1])),
                                          None)
                if first_original_loc:
                    date_ms = int(first_original_loc['timestampMs'])
                    walk_date = datetime.fromtimestamp(date_ms / 1000).strftime('%Y-%m-%d %H:%M:%S')
                else:
                    walk_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')  # Fallback

                cursor.execute(
                    'INSERT INTO walks (name, date, description, path_geojson, co2_saved) VALUES (?, ?, ?, ?, ?)',
                    (f"Прогулка от {walk_date}", walk_date, "Импортировано из Google Location History", json.dumps(geojson_path), co2_saved)
                )
            db.commit()
            return jsonify({'message': f'Successfully processed {len(walk_routes)} potential walks.'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    init_db()
    app.run(debug=True)