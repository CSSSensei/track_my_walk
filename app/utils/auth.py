from functools import wraps

from flask import current_app, jsonify, request


def require_api_key(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        expected = current_app.config.get("API_KEY")
        provided = request.headers.get("X-API-Key")

        if not expected or not provided or provided != expected:
            return jsonify({"error": "Unauthorized: Invalid or missing API Key"}), 401

        return fn(*args, **kwargs)

    return wrapper
