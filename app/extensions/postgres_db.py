from datetime import datetime

import psycopg2
from psycopg2 import Error
from typing import List, Optional

from psycopg2.extras import Json

from app.models.walk import Walk
from app.extensions.db_interface import DBInterface
from config import Config


class PostgreSQLDB(DBInterface):
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.db_config = {k: v for k, v in Config.POSTGRES_DATABASE.items() if v is not None}

    def _execute_query(self, query: str, params: tuple = None, fetch_type: str = None):
        """
        Внутренний метод для выполнения запросов и обработки ошибок.
        :param query: SQL-запрос.
        :param params: Параметры для запроса.
        :param fetch_type: 'one', 'all' или None для DDL/DML.
        :return: Результат выборки или None.
        """
        if not self.conn or self.conn.closed:
            self.connect()
        try:
            self.cursor.execute(query, params)

            result = None
            if fetch_type == 'one':
                result = self.cursor.fetchone()
            elif fetch_type == 'all':
                result = self.cursor.fetchall()

            if not query.strip().upper().startswith("SELECT"):
                self.conn.commit()

            return result
        except Error:
            if self.conn:
                self.conn.rollback()  # Откат транзакции в случае ошибки
            raise

    def connect(self):
        """
        Устанавливает соединение с базой данных PostgreSQL.
        """
        if self.conn is None or self.conn.closed:
            try:
                self.conn = psycopg2.connect(**self.db_config)
                self.cursor = self.conn.cursor()
            except Error:
                self.conn = None
                self.cursor = None
                raise

    def close(self):
        """
        Закрывает соединение и курсор базы данных PostgreSQL.
        """
        if self.cursor:
            self.cursor.close()
            self.cursor = None
        if self.conn:
            self.conn.close()
            self.conn = None

    def init_db(self):
        """
        Инициализирует схему базы данных PostgreSQL.
        Создает таблицу 'walks', если она еще не существует, в соответствии с классом Walk.
        """
        try:
            self.connect()
            create_table_query = """
            CREATE TABLE IF NOT EXISTS walks (
                id SERIAL PRIMARY KEY,
                name TEXT,
                date INTEGER,
                description TEXT,
                path_geojson JSONB, -- Storing as GeoJSON LineString string
                distance NUMERIC(10, 2), -- REAL в SQLite, NUMERIC для точности в PG
                co2_saved NUMERIC(10, 2) -- REAL в SQLite, NUMERIC для точности в PG
            );
            """
            self._execute_query(create_table_query)
        except Error:
            self.close()

    def get_walks(self) -> List[Walk]:
        """
        Извлекает все прогулки из базы данных, отсортированные по дате по убыванию.
        :return: Список объектов Walk.
        """
        query = "SELECT id, name, date, description, path_geojson, distance, co2_saved FROM walks ORDER BY date DESC;"
        rows = self._execute_query(query, fetch_type='all')
        if rows:
            return [Walk.from_postgres_row(row) for row in rows]
        return []

    def get_walk_by_id(self, walk_id: int) -> Optional[Walk]:
        """
        Извлекает одну прогулку по ее ID.
        :param walk_id: ID прогулки.
        :return: Объект Walk или None, если прогулка не найдена.
        """
        query = "SELECT id, name, date, description, path_geojson, distance, co2_saved FROM walks WHERE id = %s;"
        row = self._execute_query(query, (walk_id,), fetch_type='one')
        if row:
            return Walk.from_postgres_row(row)
        return None

    def add_walk(self, walk: Walk) -> int:
        """
        Добавляет новую прогулку в базу данных и возвращает ее ID.
        :param walk: Объект Walk для добавления.
        :return: ID добавленной прогулки.
        """
        query = """
        INSERT INTO walks (name, date, description, path_geojson, distance, co2_saved)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id;
        """
        params = (walk.name, walk.date, walk.description, Json(walk.path_geojson), walk.distance, walk.co2_saved)
        result_id = self._execute_query(query, params, fetch_type='one')
        if result_id:
            return result_id[0]
        raise RuntimeError("Не удалось получить ID новой прогулки.")

    def update_walk(self, walk: Walk) -> None:
        """
        Обновляет существующую прогулку в базе данных.
        :param walk: Объект Walk с обновленными данными (должен иметь ID).
        """
        if walk.id is None:
            raise ValueError("Для обновления прогулки требуется ID.")
        query = """
        UPDATE walks
        SET name = %s, date = %s, description = %s, path_geojson = %s, distance = %s, co2_saved = %s
        WHERE id = %s;
        """
        params = (walk.name, walk.date, walk.description, Json(walk.path_geojson), walk.distance, walk.co2_saved, walk.id)
        self._execute_query(query, params)

    def delete_walk(self, walk_id: int) -> bool:
        """
        Удаляет прогулку из базы данных по ее ID.
        :param walk_id: ID прогулки для удаления.
        :return: True, если прогулка была удалена, False в противном случае.
        """
        query = "DELETE FROM walks WHERE id = %s;"
        self._execute_query(query, (walk_id,))
        rows_affected = self.cursor.rowcount
        return rows_affected > 0


if __name__ == '__main__':

    print("--- Инициализация PostgreSQLDB ---")
    db = PostgreSQLDB()

    try:
        # Инициализация базы данных (создание таблицы)
        db.init_db()

        # Добавление новой прогулки
        print("\n--- Добавление прогулки ---")
        new_walk = Walk(id=None, name="Утренняя пробежка", date=int(datetime(2025, 8, 1).timestamp()),
                        description="Быстрая пробежка по району.",
                        path_geojson={"type": "LineString", "coordinates": [[100.0, 0.0], [101.0, 1.0]]}, # Теперь это словарь
                        distance=5.2, co2_saved=1.2)
        walk_id = db.add_walk(new_walk)
        print(f"Добавлена прогулка с ID: {walk_id}")

        new_walk_2 = Walk(id=None, name="Вечерняя прогулка", date=int(datetime(2025, 8, 2).timestamp()),
                          description="Спокойная прогулка по парку.",
                          path_geojson={"type": "LineString", "coordinates": [[102.0, 2.0], [103.0, 3.0]]}, # Теперь это словарь
                          distance=3.0, co2_saved=0.7)
        walk_id_2 = db.add_walk(new_walk_2)
        print(f"Добавлена вторая прогулка с ID: {walk_id_2}")

        # Получение всех прогулок
        print("\n--- Получение всех прогулок ---")
        walks = db.get_walks()
        for walk in walks:
            print(walk)
            # Проверяем тип
            print(f"Тип path_geojson: {type(walk.path_geojson)}")


        # Получение прогулки по ID
        print(f"\n--- Получение прогулки по ID: {walk_id} ---")
        retrieved_walk = db.get_walk_by_id(walk_id)
        if retrieved_walk:
            print(retrieved_walk)
            print(f"Тип path_geojson: {type(retrieved_walk.path_geojson)}")
        else:
            print(f"Прогулка с ID {walk_id} не найдена.")

        # Обновление прогулки
        print(f"\n--- Обновление прогулки с ID: {walk_id} ---")
        if retrieved_walk:
            retrieved_walk.name = "Утренняя пробежка (обновлено)"
            retrieved_walk.description = "Очень быстрая пробежка, побил свой рекорд!"
            retrieved_walk.distance = 5.5
            retrieved_walk.path_geojson = {"type": "LineString", "coordinates": [[100.0, 0.0], [101.0, 1.0], [102.0, 0.0]]} # Обновляем dict
            db.update_walk(retrieved_walk)
            updated_walk = db.get_walk_by_id(walk_id)
            print(updated_walk)
            print(f"Тип path_geojson: {type(updated_walk.path_geojson)}")

        # Удаление прогулки
        print(f"\n--- Удаление прогулки с ID: {walk_id_2} ---")
        deleted = db.delete_walk(walk_id_2)
        if deleted:
            print(f"Прогулка с ID {walk_id_2} успешно удалена.")
        else:
            print(f"Не удалось удалить прогулку с ID {walk_id_2}.")

        print("\n--- Проверка оставшихся прогулок ---")
        remaining_walks = db.get_walks()
        for walk in remaining_walks:
            print(walk)

    except Exception as e:
        print(f"Произошла ошибка во время тестирования: {e}")
    finally:
        if db.conn:
            db.close()
