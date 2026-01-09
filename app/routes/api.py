from typing import Any, Dict, List, Optional

from flask import Blueprint, abort, current_app, jsonify, request

from app.utils.auth import require_api_key
from app.utils.recommended_route import get_recommended_route
from app.utils.walk_processing import import_walks_from_json
from ..extensions.database import get_db_interface
from ..models.route import Route
from ..models.walk import Walk

bp = Blueprint("api", __name__, url_prefix="/api")


def _get_json_object() -> Dict[str, Any]:
    data = request.get_json(silent=True)
    if data is None:
        abort(400, description="Invalid or missing JSON body.")
    if not isinstance(data, dict):
        abort(400, description="JSON body must be an object.")
    return data


@bp.app_errorhandler(400)
def handle_bad_request(err):
    return jsonify({"error": getattr(err, "description", "Bad request")}), 400


@bp.app_errorhandler(401)
def handle_unauthorized(err):
    return jsonify({"error": getattr(err, "description", "Unauthorized")}), 401


@bp.app_errorhandler(404)
def handle_not_found(err):
    return jsonify({"error": getattr(err, "description", "Not found")}), 404


@bp.app_errorhandler(500)
def handle_server_error(err):
    return jsonify({"error": getattr(err, "description", "Internal server error")}), 500


@bp.route("/upload_location_history", methods=["POST"])
@require_api_key
def upload_location_history():
    if "file" not in request.files:
        abort(400, description="No file part.")

    file = request.files["file"]
    if not file or file.filename == "":
        abort(400, description="No selected file.")

    if not file.filename.lower().endswith(".json"):
        abort(400, description="Only .json files are supported.")

    try:
        len_walk_routes = import_walks_from_json(file)
    except Exception:
        current_app.logger.exception("Failed to import walks from uploaded location history.")
        abort(500, description="Failed to process uploaded file.")

    return jsonify({"message": f"Successfully processed {len_walk_routes} potential walks."}), 200


@bp.route('/generate_route', methods=['POST'])
def api_recommend_route():
    data = _get_json_object()

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

    if start_point is not None:
        if not isinstance(start_point, list) or len(start_point) != 2:
            abort(400, description="start_point must be a list of two numbers [lon, lat].")
        try:
            start_point = [float(start_point[0]), float(start_point[1])]
        except (ValueError, TypeError):
            abort(400, description="start_point coordinates must be valid numbers.")

    try:
        db_interface = get_db_interface()
        walks: List[Walk] = db_interface.get_walks()
    except Exception:
        current_app.logger.exception("Failed to load walks from DB.")
        abort(500, description="Failed to load walks data.")

    ors_api_key = current_app.config.get("ORS_API_KEY")
    if not ors_api_key:
        abort(500, description="ORS_API_KEY is not configured.")

    try:
        recommended_route: Optional[Route] = get_recommended_route(
            ors_api_key,
            time_minutes,
            walks,
            angle,
            segments,
            start_point
        )
    except Exception:
        current_app.logger.exception("Failed to generate recommended route.")
        abort(500, description="Failed to generate route.")

    if not recommended_route:
        abort(404, description="Failed to generate a recommended route. Try different parameters or location.")

    return jsonify(recommended_route.to_dict())
