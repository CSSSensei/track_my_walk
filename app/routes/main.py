from typing import List
from flask import Blueprint, render_template, jsonify, abort
from ..extensions.database import get_db_interface
from ..models.walk import Walk

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/walks', methods=['GET'])
def get_walks():
    db_interface = get_db_interface()
    walks: List[Walk] = db_interface.get_walks()  # Получаем список объектов Walk
    return jsonify([walk.to_dict() for walk in walks])


@bp.route('/all_walks')
def all_walks():
    """Отображает страницу со всеми прогулками."""
    return render_template('all_walks.html')


@bp.route('/recommend', methods=['GET'])
def recommend_page():
    return render_template('recommend.html')


@bp.route('/walk/<int:walk_id>')
def single_walk(walk_id):
    """
    Отображает страницу с деталями одной прогулки и её картой.
    """
    db_interface = get_db_interface()
    walk = db_interface.get_walk_by_id(walk_id)

    if walk is None:
        abort(404, description="Прогулка не найдена")

    photos = db_interface.get_photos_by_walk_id(walk_id)

    walk_data = {
        'id': walk.id,
        'name': walk.name,
        'date': walk.date,
        'description': walk.description,
        'distance': walk.distance,
        'co2_saved': walk.co2_saved,
        'path_geojson': walk.path_geojson,
        'photos': [{'id': p.id, 'url': p.url, 'description': p.description, 'latitude': p.latitude, 'longitude': p.longitude, 'thumbnail_url': p.thumbnail_url} for p in photos]
    }
    return render_template('single_walk.html', walk=walk_data)


@bp.route('/walk/<int:walk_id>/photos', methods=['GET'])
def get_walk_photos(walk_id):
    try:
        db_interface = get_db_interface()
        photos = db_interface.get_photos_by_walk_id(walk_id)

        if not photos:
            return jsonify([]), 200

        photos_data = [
            {
                'id': p.id,
                'url': p.url,
                'description': p.description,
                'latitude': p.latitude,
                'longitude': p.longitude,
                'thumbnail_url': p.thumbnail_url
            } for p in photos
        ]
        return jsonify(photos_data), 200
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

