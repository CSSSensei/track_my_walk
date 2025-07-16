from typing import List, Optional
from flask import Blueprint, request, jsonify, current_app, abort
from app.utils.recommended_route import get_recommended_route
from ..extensions.database import get_db_interface

from app.utils.walk_processing import import_walks_from_json
from ..models.route import Route
from ..models.walk import Walk

bp = Blueprint('api', __name__, url_prefix='/api')  # API routes prefixed with /api


@bp.route('/upload_location_history', methods=['POST'])
def upload_location_history():
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
            len_walk_routes = import_walks_from_json(file)
            return jsonify({'message': f'Successfully processed {len_walk_routes} potential walks.'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500


@bp.route('/generate_route', methods=['POST'])
def api_recommend_route():
    data = request.get_json()

    time_minutes = data.get('time_minutes', 60)
    angle = data.get('angle', 60)
    segments = data.get('segments', 1)
    start_point = data.get('start_point')

    if not isinstance(time_minutes, int) or time_minutes <= 0:
        abort(400, description="time_minutes must be a positive integer.")
    if not isinstance(angle, int) or not (0 <= angle <= 180):
        abort(400, description="angle must be an integer between 0 and 180.")
    if not isinstance(segments, int) or segments <= 0:
        abort(400, description="segments must be a positive integer.")

    if start_point:
        if not isinstance(start_point, list) or len(start_point) != 2:
            abort(400, description="start_point must be a list of two floats [lon, lat].")
        try:
            start_point = [float(start_point[0]), float(start_point[1])]
        except (ValueError, TypeError):
            abort(400, description="start_point coordinates must be valid numbers.")

    db_interface = get_db_interface()
    walks: List[Walk] = db_interface.get_walks()

    recommended_route: Optional[Route] = get_recommended_route(
        current_app.config['ORS_API_KEY'],
        time_minutes,
        walks,
        angle,
        segments,
        start_point
    )

    if recommended_route:
        return jsonify(recommended_route.to_dict())
    else:
        return jsonify({"error": "Failed to generate a recommended route. Try different parameters or location."}, 404)
