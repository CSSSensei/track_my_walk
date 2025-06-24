import json
from flask import Blueprint, render_template, jsonify, abort
from ..extensions import database

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/walks', methods=['GET'])
def get_walks():
    """Возвращает все прогулки из БД, отсортированные по дате (от новой к старой)."""
    db = database.get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks ORDER BY date DESC')
    walks = cursor.fetchall()
    # Преобразуем Row объекты в словари для jsonify
    return jsonify([dict(walk) for walk in walks])


@bp.route('/all_walks')
def all_walks():
    """Отображает страницу со всеми прогулками."""
    return render_template('all_walks.html')


@bp.route('/walk/<int:walk_id>')
def single_walk(walk_id):
    """
    Отображает страницу с деталями одной прогулки и её картой.
    """
    db = database.get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks WHERE id = ?', (walk_id,))
    walk = cursor.fetchone()

    if walk is None:
        abort(404, description="Прогулка не найдена")

    return render_template('single_walk.html', walk=dict(walk))
