import sqlite3
from typing import List, Optional

from flask import current_app, g
from pprint import pprint
from app.models.walk import Walk


def get_db():
    if 'db' not in g:
        db_path = current_app.config['DATABASE']
        g.db = sqlite3.connect(
            db_path,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db(app):
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS walks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                date INTEGER,
                description TEXT,
                path_geojson TEXT, -- Storing as GeoJSON LineString string
                distance REAL,
                co2_saved REAL
            )
        ''')
        db.commit()


def init_db_command(app):
    with app.app_context():
        init_db(app)
        print('Initialized the database.')


def get_walks_from_db() -> List[Walk]:
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks ORDER BY date DESC')
    walks_data = cursor.fetchall()
    return [Walk.from_db_row(walk) for walk in walks_data]


def get_walk_by_id(walk_id: int) -> Optional[Walk]:
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks WHERE id = ?', (walk_id,))
    walk = cursor.fetchone()
    print(dict(walk))
    if walk:
        return Walk.from_db_row(walk)
    return None


if __name__ == '__main__':
    from config import Config
    # print(Config.DATABASE)
    # db = sqlite3.connect(Config.DATABASE)
    # cursor = db.cursor()
    # cursor.execute('SELECT * FROM walks ORDER BY date DESC LIMIT 10')
    # rows = cursor.fetchall()
    # cursor.execute('PRAGMA table_info(walks)')
    # columns = [column[1] for column in cursor.fetchall()]
    # for row in rows:
    #     pprint(dict(zip(columns, row)))
    # db.close()
    db = sqlite3.connect(Config.DATABASE)
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks ORDER BY date DESC LIMIT 2')
    walks_data = cursor.fetchall()
    # Преобразуем Row объекты в словари для jsonify
    print(list(Walk.from_db_row(walk).to_dict() for walk in walks_data))