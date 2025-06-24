import json
from flask import Blueprint, render_template, jsonify
import database

bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/walks', methods=['GET'])
def get_walks():
    db = database.get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks ORDER BY date DESC')
    walks = cursor.fetchall()
    return jsonify([dict(walk) for walk in walks])
