from typing import List

from flask import Blueprint, render_template, jsonify, abort
from ..extensions import database
from ..models.walk import Walk

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/walks', methods=['GET'])
def get_walks():
    walks: List[Walk] = database.get_walks_from_db()  # Получаем список объектов Walk
    return jsonify([walk.to_dict() for walk in walks])


@bp.route('/all_walks')
def all_walks():
    """Отображает страницу со всеми прогулками."""
    return render_template('all_walks.html')


@bp.route('/walk/<int:walk_id>')
def single_walk(walk_id):
    """
    Отображает страницу с деталями одной прогулки и её картой.
    """
    walk = database.get_walk_by_id(walk_id)

    if walk is None:
        abort(404, description="Прогулка не найдена")

    return render_template('single_walk.html', walk=walk.to_dict())
