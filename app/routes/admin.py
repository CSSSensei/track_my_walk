import json
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session, flash, current_app
from datetime import datetime
from app.utils import distance
from werkzeug.utils import secure_filename
import os
from ..extensions.database import get_db_interface
from ..models.walk import Walk
from ..utils.image_utils import create_thumbnail
from ..utils.walk_processing import import_walks_from_json

bp = Blueprint('admin', __name__, url_prefix='/admin')  # Admin routes prefixed with /admin


@bp.route('/')
def admin_page():
    if not session.get('is_authenticated'):
        flash('Доступ запрещен. Пожалуйста, войдите.', 'error')
        return redirect(url_for('admin.admin_login'))
    return render_template('admin.html')


@bp.route('/login', methods=['GET', 'POST'])  # /admin/login
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

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
    return redirect(url_for('main.index'))


@bp.route('/add_walk', methods=['POST'])  # /admin/add_walk
def add_walk():
    if not session.get('is_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.json
        name = data.get('name')
        description = data.get('description')
        coordinates = data.get('coordinates')
        if not name or not coordinates:
            return jsonify({'error': 'Missing name or coordinates'}), 400
        if not isinstance(coordinates, list) or not all(isinstance(c, list) and len(c) == 2 for c in coordinates):
            return jsonify({'error': 'Invalid coordinates format. Expected [[lon, lat], ...]'})

        date_str = data.get('date', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        try:
            walk_date = datetime.strptime(date_str, '%Y-%m-%d %H:%M')
        except ValueError:
            walk_date = datetime.now()

        walk_distance = 0
        co2_saved = 0
        geojson_path = {}

        if len(coordinates) < 2:
            geojson_path = {
                "type": "Point",
                "coordinates": coordinates[0] if coordinates else []
            }
        else:
            geojson_path = {
                "type": "LineString",
                "coordinates": coordinates
            }
            for i in range(len(coordinates) - 1):
                p1_lon, p1_lat = coordinates[i]
                p2_lon, p2_lat = coordinates[i + 1]
                walk_distance += distance.calculate_distance_km(p1_lat, p1_lon, p2_lat, p2_lon)
            co2_saved = walk_distance * 0.15

        db_interface = get_db_interface()
        walk_id = db_interface.add_walk(Walk(id=-1, name=name,
                                   date=int(walk_date.timestamp()),
                                   description=description,
                                   path_geojson=geojson_path,
                                   distance=walk_distance,
                                   co2_saved=co2_saved))
        return jsonify({'message': 'Walk added successfully', 'id': walk_id}), 200
    except Exception as e:
        current_app.logger.error(f"Error adding walk: {e}", exc_info=True)
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@bp.route('/walks-manager')  # /admin/walks-manager
def walks_manager():
    if not session.get('is_authenticated'):
        flash('Доступ запрещен. Пожалуйста, войдите.', 'error')
        return redirect(url_for('admin.admin_login'))
    return render_template('admin_walks_manager.html')


@bp.route('/edit-walk/<int:walk_id>', methods=['GET'])  # /admin/edit-walk/<int:walk_id>
def edit_walk_page(walk_id):
    if not session.get('is_authenticated'):
        flash('Доступ запрещен. Пожалуйста, войдите.', 'error')
        return redirect(url_for('admin.admin_login'))
    db_interface = get_db_interface()
    walk = db_interface.get_walk_by_id(walk_id)
    if not walk:
        flash('Прогулка не найдена.', 'error')
        return redirect(url_for('admin.walks_manager'))

    date_obj = datetime.fromtimestamp(walk.date)
    walk.date = date_obj.strftime('%Y-%m-%dT%H:%M:%S')
    walk_data = {
        'id': walk.id,
        'name': walk.name,
        'date_formatted': date_obj.strftime('%Y-%m-%dT%H:%M:%S'),
        'description': walk.description,
        'path_geojson': walk.path_geojson
    }
    walk_data_json = json.dumps(walk_data)

    return render_template('admin_edit_walk.html', walk=walk, walk_data_json=walk_data_json)


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
            current_app.logger.error(f"Error processing uploaded file: {e}", exc_info=True)
            return jsonify({'message': str(e)}), 500


@bp.route('/walks/<int:walk_id>', methods=['GET'])
def get_walk_by_id_admin(walk_id):
    if not session.get('is_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        db_interface = get_db_interface()
        walk = db_interface.get_walk_by_id(walk_id)

        if not walk:
            return jsonify({'message': 'Walk not found'}), 404

        walk_data = {
            'id': walk.id,
            'name': walk.name,
            'date': walk.date,
            'description': walk.description,
            'distance': walk.distance,
            'co2_saved': walk.co2_saved,
            'path_geojson': walk.path_geojson
        }
        return jsonify(walk_data), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching walk {walk_id} for admin: {e}", exc_info=True)
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@bp.route('/walks/<int:walk_id>', methods=['PUT'])
def update_walk(walk_id):
    if not session.get('is_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.json
        db_interface = get_db_interface()
        existing_walk = db_interface.get_walk_by_id(walk_id)

        if not existing_walk:
            return jsonify({'message': 'Walk not found'}), 404

        existing_walk.name = data.get('name', existing_walk.name)
        existing_walk.description = data.get('description', existing_walk.description)
        date_str = data.get('date')
        if date_str:
            try:
                walk_date = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                existing_walk.date = int(walk_date.timestamp())
            except ValueError:
                current_app.logger.warning(f"Invalid date format received for walk {walk_id}: {date_str}. Keeping old date.")

        if 'path_geojson' in data:
            try:
                new_geojson = json.loads(data['path_geojson'])
                existing_walk.path_geojson = data['path_geojson']
                coordinates = []
                if new_geojson.get("type") == "LineString":
                    coordinates = new_geojson.get("coordinates", [])
                elif new_geojson.get("type") == "Point" and new_geojson.get("coordinates"):
                    coordinates = [new_geojson.get("coordinates")]
                elif new_geojson.get("type") == "Feature":
                    geometry = new_geojson.get("geometry", {})
                    if geometry.get("type") == "LineString" and geometry.get('coordinates'):
                        coordinates = geometry.get("coordinates", [])
                        existing_walk.path_geojson = geometry

                walk_distance = 0
                if len(coordinates) > 1:
                    for i in range(len(coordinates) - 1):
                        p1_lon, p1_lat = coordinates[i]
                        p2_lon, p2_lat = coordinates[i + 1]
                        walk_distance += distance.calculate_distance_km(p1_lat, p1_lon, p2_lat, p2_lon)
                existing_walk.distance = walk_distance
                existing_walk.co2_saved = walk_distance * 0.15

            except json.JSONDecodeError:
                return jsonify({'error': 'Invalid path_geojson format. Must be a valid JSON string.'}), 400
            except Exception as geo_e:
                current_app.logger.error(f"Error processing path_geojson for walk {walk_id}: {geo_e}", exc_info=True)
                return jsonify({'error': f'Error processing map data: {str(geo_e)}'}), 400
        db_interface.update_walk(existing_walk)

        return jsonify({'message': f'Walk {walk_id} updated successfully'}), 200

    except Exception as e:
        current_app.logger.error(f"Error updating walk {walk_id}: {e}", exc_info=True)
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@bp.route('/walks/<int:walk_id>', methods=['DELETE'])
def delete_walk(walk_id):
    if not session.get('is_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        db_interface = get_db_interface()
        success = db_interface.delete_walk(walk_id)

        if success:
            return jsonify({'message': f'Walk {walk_id} deleted successfully'}), 200
        else:
            return jsonify({'message': 'Walk not found or could not be deleted'}), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting walk {walk_id}: {e}", exc_info=True)
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@bp.route('/upload_photo', methods=['POST'])
def upload_photo():
    if not session.get('is_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401

    if 'photo' not in request.files:
        return jsonify({'error': 'No photo file provided'}), 400

    photo = request.files['photo']
    walk_id = request.form.get('walk_id')
    latitude = request.form.get('latitude')
    longitude = request.form.get('longitude')
    description = request.form.get('description', '')

    if not walk_id or not latitude or not longitude:
        return jsonify({'error': 'Missing walk_id, latitude, or longitude'}), 400

    try:
        walk_id = int(walk_id)
        latitude = float(latitude)
        longitude = float(longitude)
    except ValueError:
        return jsonify({'error': 'Invalid walk_id, latitude, or longitude format'}), 400

    if photo.filename == '':
        return jsonify({'error': 'No selected photo file'}), 400

    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'app/static/uploads/photos')
    if not os.path.exists(upload_folder):
        os.makedirs(upload_folder)

    filename = secure_filename(photo.filename)
    filepath = os.path.join(upload_folder, filename)
    photo_url = f'/static/uploads/photos/{filename}'

    try:
        photo.save(filepath)

        _, thumb_url = create_thumbnail(filepath, upload_folder, filename)

        db_interface = get_db_interface()
        photo_id = db_interface.add_photo(
            walk_id=walk_id,
            url=photo_url,
            description=description,
            latitude=latitude,
            longitude=longitude,
            thumbnail_url=thumb_url
        )

        return jsonify({
            'message': 'Photo uploaded successfully',
            'photo_id': photo_id,
            'url': photo_url,
            'thumbnail_url': thumb_url
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error uploading photo: {e}", exc_info=True)
        return jsonify({'error': f'An error occurred during photo upload: {str(e)}'}), 500


@bp.route('/photos/<int:photo_id>', methods=['DELETE'])
def delete_photo(photo_id):
    if not session.get('is_authenticated'):
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        db_interface = get_db_interface()
        success = db_interface.delete_photo(photo_id)

        if success:
            return jsonify({'message': f'Photo {photo_id} deleted successfully'}), 200
        else:
            return jsonify({'message': 'Photo not found or could not be deleted'}), 404
    except Exception as e:
        current_app.logger.error(f"Error deleting photo {photo_id}: {e}", exc_info=True)
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500
