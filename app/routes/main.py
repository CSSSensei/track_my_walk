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


@bp.route('/walk/<int:walk_id>')
def single_walk(walk_id):
    """
    Отображает страницу с деталями одной прогулки и её картой.
    """
    db_interface = get_db_interface()
    walk = db_interface.get_walk_by_id(walk_id)

    if walk is None:
        abort(404, description="Прогулка не найдена")

    return render_template('single_walk.html', walk=walk.to_dict())
