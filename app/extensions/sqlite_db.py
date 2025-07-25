import json
import sqlite3
from typing import List, Optional
from flask import current_app, g

from app.models.photo import Photo
from app.models.walk import Walk
from app.extensions.db_interface import DBInterface


class SQLiteDB(DBInterface):
    def __init__(self, db_path: Optional[str] = None):
        # can make db_path an instance variable for more flexibility
        # If not provided, it will be fetched from Flask's current_app.config when connect is called
        self._db_path = db_path
        self._db = None

    def connect(self):
        if self._db is None:
            db_path = self._db_path if self._db_path else current_app.config['SQLITE_DATABASE']
            self._db = sqlite3.connect(
                db_path,
                detect_types=sqlite3.PARSE_DECLTYPES
            )
            self._db.row_factory = sqlite3.Row
        return self._db

    def close(self):
        if self._db is not None:
            self._db.close()
            self._db = None

    def init_db(self):
        with current_app.app_context():
            db = self.connect()
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
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS photos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    walk_id INTEGER,
                    url TEXT,
                    description TEXT,
                    latitude REAL,
                    longitude REAL,
                    thumbnail_url TEXT
                )
            ''')
            db.commit()

    def get_walks(self) -> List[Walk]:
        db = self.connect()
        cursor = db.cursor()
        cursor.execute('SELECT * FROM walks ORDER BY date DESC')
        walks_data = cursor.fetchall()
        return [Walk.from_db_row(walk) for walk in walks_data]

    def get_walk_by_id(self, walk_id: int) -> Optional[Walk]:
        db = self.connect()
        cursor = db.cursor()
        cursor.execute('SELECT * FROM walks WHERE id = ?', (walk_id,))
        walk = cursor.fetchone()
        if walk:
            return Walk.from_db_row(walk)
        return None

    def add_walk(self, walk: Walk) -> int:
        db = self.connect()
        cursor = db.cursor()
        # convert the dict to a JSON string for storage
        path_geojson_str = json.dumps(walk.path_geojson) if walk.path_geojson else None

        cursor.execute(
            '''
            INSERT INTO walks (name, date, description, path_geojson, distance, co2_saved)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (
                walk.name,
                walk.date,
                walk.description,
                path_geojson_str,
                walk.distance,
                walk.co2_saved
            )
        )
        db.commit()
        return cursor.lastrowid

    def update_walk(self, walk: Walk) -> bool:
        if not walk.id:
            raise ValueError("Walk ID is required for update")

        db = self.connect()
        cursor = db.cursor()

        try:
            path_geojson_str = json.dumps(walk.path_geojson) if walk.path_geojson else None

            cursor.execute(
                '''
                UPDATE walks 
                SET 
                    name = ?,
                    date = ?,
                    description = ?,
                    path_geojson = ?,
                    distance = ?,
                    co2_saved = ?
                WHERE id = ?
                ''',
                (
                    walk.name,
                    walk.date,
                    walk.description,
                    path_geojson_str,
                    walk.distance,
                    walk.co2_saved,
                    walk.id
                )
            )

            db.commit()
            return cursor.rowcount > 0

        except Exception as e:
            db.rollback()
            raise RuntimeError(f"Failed to update walk: {str(e)}")
        finally:
            cursor.close()

    def delete_walk(self, walk_id: int) -> bool:
        if not walk_id or not isinstance(walk_id, int):
            raise ValueError("Invalid walk ID provided")

        db = self.connect()
        cursor = db.cursor()

        try:
            cursor.execute("DELETE FROM walks WHERE id = ?", (walk_id,))
            db.commit()
            return cursor.rowcount > 0

        except sqlite3.Error as e:
            db.rollback()
            raise RuntimeError(f"Failed to delete walk: {str(e)}")
        finally:
            cursor.close()

    def get_photos_by_walk_id(self, walk_id: int) -> List[Photo]:
        db = self.connect()
        cursor = db.cursor()
        cursor.execute('''
            SELECT * FROM photos 
            WHERE walk_id = ?
            ORDER BY id
        ''', (walk_id,))
        photos_data = cursor.fetchall()
        return [Photo.from_sqlite_row(photo) for photo in photos_data]

    def add_photo(self, walk_id: int, url: str, description: Optional[str],
                 latitude: float, longitude: float, thumbnail_url: str) -> int:
        db = self.connect()
        cursor = db.cursor()
        cursor.execute(
            '''
            INSERT INTO photos (walk_id, url, description, latitude, longitude, thumbnail_url)
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (
                walk_id,
                url,
                description,
                latitude,
                longitude,
                thumbnail_url
            )
        )
        db.commit()
        return cursor.lastrowid

    def delete_photo(self, photo_id: int) -> bool:
        if not photo_id or not isinstance(photo_id, int):
            raise ValueError("Invalid photo ID provided")

        db = self.connect()
        cursor = db.cursor()

        try:
            cursor.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
            db.commit()
            return cursor.rowcount > 0

        except sqlite3.Error as e:
            db.rollback()
            raise RuntimeError(f"Failed to delete photo: {str(e)}")
        finally:
            cursor.close()


if __name__ == '__main__':
    from config import Config
    db = sqlite3.connect(Config.SQLITE_DATABASE)
    cursor = db.cursor()
    cursor.execute('SELECT * FROM walks')
    print(cursor.fetchall())