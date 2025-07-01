import json
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session, flash, current_app
from datetime import datetime
from ..extensions import database
from app.utils import distance
from ..utils.walk_processing import import_walks_from_json

bp = Blueprint('admin', __name__, url_prefix='/admin')  # Admin routes prefixed with /admin


@bp.route('/')
def admin_page():
    if not session.get('is_authenticated'):
        flash('Доступ запрещен. Пожалуйста, войдите.', 'error')
        return redirect(url_for('admin.admin_login'))  # Use blueprint name
    return render_template('admin.html')


@bp.route('/login', methods=['GET', 'POST'])  # /admin/login
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        # Use app.config to get admin credentials
        ADMIN_USERNAME = current_app.config['ADMIN_USERNAME']
        ADMIN_PASSWORD = current_app.config['ADMIN_PASSWORD']

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['is_authenticated'] = True
            return redirect(url_for('admin.admin_page'))
        else:
            flash('Неверное имя пользователя или пароль.', 'error')
    return render_template('admin_login.html')


@bp.route('/logout')  # /admin/logout
def admin_logout():
    session.pop('is_authenticated', None)
    return redirect(url_for('main.index'))  # Redirect to main index after logout


@bp.route('/add_walk', methods=['POST'])  # /admin/add_walk
def add_walk():
    if not session.get('is_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.json
        name = data['name']
        description = data['description']
        coordinates = data['coordinates']  # This can be coordinates from map OR string input

        date_str = data.get('date', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        try:
            walk_date = datetime.strptime(date_str, '%Y-%m-%d %H:%M')
        except ValueError:
            walk_date = datetime.now()

        if not isinstance(coordinates, list) or not all(isinstance(c, list) and len(c) == 2 for c in coordinates):
            return jsonify({'error': 'Invalid coordinates format. Expected [[lon, lat], ...]'})

        # Adjust logic to handle single point (type Point) or multiple (LineString)
        if len(coordinates) < 2:
            geojson_path = {
                "type": "Point",  # If only one point
                "coordinates": coordinates[0]
            }
            walk_distance = 0  # No distance for a single point
            co2_saved = 0
        else:
            geojson_path = {
                "type": "LineString",
                "coordinates": coordinates
            }
            walk_distance = 0
            for i in range(len(coordinates) - 1):
                p1_lon, p1_lat = coordinates[i]
                p2_lon, p2_lat = coordinates[i + 1]
                walk_distance += distance.calculate_distance_km(p1_lat, p1_lon, p2_lat, p2_lon)
            co2_saved = walk_distance * 0.15  # Example: 150g CO2 per km

        db = database.get_db()
        cursor = db.cursor()
        cursor.execute(
            'INSERT INTO walks (name, date, description, path_geojson, distance, co2_saved) VALUES (?, ?, ?, ?, ?, ?)',
            (name, int(walk_date.timestamp()), description, json.dumps(geojson_path), walk_distance, co2_saved)
        )
        db.commit()
        return jsonify({'message': 'Walk added successfully'}), 200

    except KeyError as e:
        return jsonify({'error': f'Missing data field: {e}'}), 400
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@bp.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'message': 'Файл не найден в запросе.'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'message': 'Файл не выбран.'}), 400

    if not file.filename.endswith('.json'):
        return jsonify({'message': 'Допустимы только JSON файлы.'}), 400

    if file:
        try:
            len_walk_routes = import_walks_from_json(file)
            return jsonify({'message': f'Successfully processed {len_walk_routes} potential walks.'}), 200
        except Exception as e:
            return jsonify({'message': str(e)}), 500
