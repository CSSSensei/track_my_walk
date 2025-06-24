import sqlite3
from flask import current_app, g
from pprint import pprint
DATABASE = 'walks.db'


def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE'],
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
                date TEXT,
                description TEXT,
                path_geojson TEXT, -- Storing as GeoJSON LineString string
                co2_saved REAL
            )
        ''')
        db.commit()


def init_db_command(app):
    with app.app_context():
        init_db(app)
        print('Initialized the database.')


if __name__ == '__main__':
    db = sqlite3.connect(DATABASE)
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks ORDER BY date DESC')
    rows = cursor.fetchall()
    cursor.execute('PRAGMA table_info(walks)')
    columns = [column[1] for column in cursor.fetchall()]
    for row in rows:
        pprint(dict(zip(columns, row)))
    db.close()
