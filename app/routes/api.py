from flask import Blueprint, request, jsonify, current_app

from app.utils.walk_processing import import_walks_from_json

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
            len_walk_routes = import_walks_from_json(file)
            return jsonify({'message': f'Successfully processed {len_walk_routes} potential walks.'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
