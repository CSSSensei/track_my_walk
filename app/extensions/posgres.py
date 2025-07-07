from datetime import datetime
from typing import List, Optional
from sqlalchemy import create_engine, text, Column, Integer, String, Float, JSON, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.exc import SQLAlchemyError

from app.extensions.db_interface import DBInterface
from app.models.walk import Walk
from app.models.photo import Photo  # Предполагаем, что у вас есть этот класс
from config import Config

Base = declarative_base()


class WalkModel(Base):
    __tablename__ = 'walks'

    id = Column(Integer, primary_key=True)
    name = Column(String)
    date = Column(Integer)
    description = Column(String)
    path_geojson = Column(JSON)
    distance = Column(Float)
    co2_saved = Column(Float)

    photos = relationship("PhotoModel", back_populates="walk", cascade="all, delete-orphan")


class PhotoModel(Base):
    __tablename__ = 'photos'

    id = Column(Integer, primary_key=True)
    walk_id = Column(Integer, ForeignKey('walks.id', ondelete='CASCADE'), nullable=False)
    url = Column(String(255), nullable=False)
    description = Column(String)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    walk = relationship("WalkModel", back_populates="photos")


class PostgresDB(DBInterface):
    def __init__(self):
        self.engine = None
        self.Session = None
        self.connect()

    def connect(self):
        try:
            db_config = {k: v for k, v in Config.POSTGRES_DATABASE.items() if v is not None}
            connection_string = f"postgresql+pg8000://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['dbname']}"
            self.engine = create_engine(connection_string)
            self.Session = sessionmaker(bind=self.engine)
        except SQLAlchemyError as e:
            print(f"Ошибка подключения к базе данных: {e}")
            raise

    def close(self):
        if self.engine:
            self.engine.dispose()
            self.engine = None
            self.Session = None

    def init_db(self):
        try:
            Base.metadata.create_all(self.engine)
        except SQLAlchemyError as e:
            print(f"Ошибка инициализации базы данных: {e}")
            raise

    def get_walks(self) -> List[Walk]:
        session = self.Session()
        try:
            walks = session.query(WalkModel).order_by(WalkModel.date.desc()).all()
            return [Walk.from_postgres_row(
                (w.id, w.name, w.date, w.description, w.path_geojson, w.distance, w.co2_saved)
            ) for w in walks]
        except SQLAlchemyError as e:
            session.rollback()
            print(f"Ошибка получения прогулок: {e}")
            raise
        finally:
            session.close()

    def get_walk_by_id(self, walk_id: int) -> Optional[Walk]:
        session = self.Session()
        try:
            walk = session.query(WalkModel).filter_by(id=walk_id).first()
            if walk:
                return Walk.from_postgres_row(
                    (walk.id, walk.name, walk.date, walk.description,
                     walk.path_geojson, walk.distance, walk.co2_saved)
                )
            return None
        except SQLAlchemyError as e:
            session.rollback()
            print(f"Ошибка получения прогулки: {e}")
            raise
        finally:
            session.close()

    def add_walk(self, walk: Walk) -> int:
        session = self.Session()
        try:
            new_walk: Walk = WalkModel(
                name=walk.name,
                date=walk.date,
                description=walk.description,
                path_geojson=walk.path_geojson,
                distance=walk.distance,
                co2_saved=walk.co2_saved
            )
            session.add(new_walk)
            session.commit()
            return new_walk.id
        except SQLAlchemyError as e:
            session.rollback()
            print(f"Ошибка добавления прогулки: {e}")
            raise
        finally:
            session.close()

    def update_walk(self, walk: Walk) -> None:
        if walk.id is None:
            raise ValueError("Для обновления прогулки требуется ID.")

        session = self.Session()
        try:
            db_walk = session.query(WalkModel).filter_by(id=walk.id).first()
            if db_walk:
                db_walk.name = walk.name
                db_walk.date = walk.date
                db_walk.description = walk.description
                db_walk.path_geojson = walk.path_geojson
                db_walk.distance = walk.distance
                db_walk.co2_saved = walk.co2_saved
                session.commit()
        except SQLAlchemyError as e:
            session.rollback()
            print(f"Ошибка обновления прогулки: {e}")
            raise
        finally:
            session.close()

    def delete_walk(self, walk_id: int) -> bool:
        session = self.Session()
        try:
            walk = session.query(WalkModel).filter_by(id=walk_id).first()
            if walk:
                session.delete(walk)
                session.commit()
                return True
            return False
        except SQLAlchemyError as e:
            session.rollback()
            print(f"Ошибка удаления прогулки: {e}")
            raise
        finally:
            session.close()

    def add_photo(self, walk_id: int, url: str, description: Optional[str], latitude: float, longitude: float) -> int:
        session = self.Session()
        try:
            new_photo: Photo = PhotoModel(
                walk_id=walk_id,
                url=url,
                description=description,
                latitude=latitude,
                longitude=longitude,
            )
            session.add(new_photo)
            session.commit()
            return new_photo.id
        except SQLAlchemyError as e:
            session.rollback()
            print(f"Ошибка добавления фотографии: {e}")
            raise
        finally:
            session.close()

    def get_photos_by_walk_id(self, walk_id: int) -> List[Photo]:
        session = self.Session()
        try:
            photos = session.query(PhotoModel).filter_by(walk_id=walk_id).order_by(PhotoModel.walk_id).all()
            return [Photo.from_postgres_row(
                (p.id, p.walk_id, p.url, p.description, p.latitude, p.longitude)
            ) for p in photos]
        except SQLAlchemyError as e:
            session.rollback()
            print(f"Ошибка получения фотографий для прогулки {walk_id}: {e}")
            raise
        finally:
            session.close()

    def delete_photo(self, photo_id: int) -> bool:
        session = self.Session()
        try:
            photo = session.query(PhotoModel).filter_by(id=photo_id).first()
            if photo:
                session.delete(photo)
                session.commit()
                return True
            return False
        except SQLAlchemyError as e:
            session.rollback()
            print(f"Ошибка удаления фотографии: {e}")
            raise
        finally:
            session.close()


if __name__ == '__main__':
    print("--- Инициализация PostgreSQLDB ---")
    db = PostgresDB()

    try:
        db.init_db()

        print("\n--- Добавление прогулки ---")
        new_walk_1 = Walk(id=None, name="Утренняя пробежка", date=int(datetime(2025, 8, 1, 9, 0, 0).timestamp()),
                          description="Быстрая пробежка по району.",
                          path_geojson={"type": "LineString", "coordinates": [[100.0, 0.0], [101.0, 1.0]]},
                          distance=5.2, co2_saved=1.2)
        walk_id_1 = db.add_walk(new_walk_1)
        print(f"Добавлена прогулка с ID: {walk_id_1}")

        # Добавление фотографий к прогулке
        print("\n--- Добавление фотографий ---")
        photo_id_1 = db.add_photo(walk_id_1, "/static/uploads/photos/photo1.jpg", "Вид на реку", 55.751, 37.617)
        print(f"Добавлена фотография с ID: {photo_id_1}")
        photo_id_2 = db.add_photo(walk_id_1, "/static/uploads/photos/photo2.jpg", "Старинное здание", 55.752, 37.620)
        print(f"Добавлена фотография с ID: {photo_id_2}")

        new_walk_2 = Walk(id=None, name="Вечерняя прогулка", date=int(datetime(2025, 8, 2, 19, 30, 0).timestamp()),
                          description="Спокойная прогулка по парку.",
                          path_geojson={"type": "LineString", "coordinates": [[102.0, 2.0], [103.0, 3.0]]},
                          distance=3.0, co2_saved=0.7)
        walk_id_2 = db.add_walk(new_walk_2)
        print(f"Добавлена вторая прогулка с ID: {walk_id_2}")
        db.add_photo(walk_id_2, "/static/uploads/photos/park.jpg", "Парковая аллея", 55.755, 37.625)

        # Получение всех прогулок
        print("\n--- Получение всех прогулок ---")
        walks = db.get_walks()
        for walk in walks:
            print(walk)

        # Получение прогулки по ID и её фотографий
        print(f"\n--- Получение прогулки по ID: {walk_id_1} и её фотографий ---")
        retrieved_walk = db.get_walk_by_id(walk_id_1)
        if retrieved_walk:
            print(retrieved_walk)
            photos_for_walk_1 = db.get_photos_by_walk_id(walk_id_1)
            print("Фотографии:")
            for photo in photos_for_walk_1:
                print(f"  {photo}")
        else:
            print(f"Прогулка с ID {walk_id_1} не найдена.")

        # Обновление прогулки
        print(f"\n--- Обновление прогулки с ID: {walk_id_1} ---")
        if retrieved_walk:
            retrieved_walk.name = "Утренняя пробежка (обновлено)"
            retrieved_walk.description = "Очень быстрая пробежка, побил свой рекорд!"
            retrieved_walk.distance = 5.5
            retrieved_walk.path_geojson = {"type": "LineString", "coordinates": [[100.0, 0.0], [101.0, 1.0], [102.0, 0.0]]}
            db.update_walk(retrieved_walk)
            updated_walk = db.get_walk_by_id(walk_id_1)
            print(updated_walk)

        # Удаление фотографии
        print(f"\n--- Удаление фотографии с ID: {photo_id_1} ---")
        deleted_photo = db.delete_photo(photo_id_1)
        if deleted_photo:
            print(f"Фотография с ID {photo_id_1} успешно удалена.")
        else:
            print(f"Не удалось удалить фотографию с ID {photo_id_1}.")
        print("\n--- Проверка оставшихся фотографий для прогулки 1 ---")
        remaining_photos_1 = db.get_photos_by_walk_id(walk_id_1)
        for photo in remaining_photos_1:
            print(f"  {photo}")


        # Удаление прогулки (должно удалить и связанные фото из-за ON DELETE CASCADE)
        print(f"\n--- Удаление прогулки с ID: {walk_id_2} ---")
        deleted_walk = db.delete_walk(walk_id_2)
        if deleted_walk:
            print(f"Прогулка с ID {walk_id_2} успешно удалена.")
            print("\n--- Проверка фотографий для удаленной прогулки (ожидается пусто) ---")
            photos_for_deleted_walk = db.get_photos_by_walk_id(walk_id_2)
            if not photos_for_deleted_walk:
                print("Фотографии для удаленной прогулки также удалены (как и ожидалось).")
            else:
                print("ОШИБКА: Фотографии для удаленной прогулки не были удалены.")
        else:
            print(f"Не удалось удалить прогулку с ID {walk_id_2}.")

        print("\n--- Проверка оставшихся прогулок ---")
        remaining_walks = db.get_walks()
        for walk in remaining_walks:
            print(walk)

    except Exception as e:
        print(f"Произошла ошибка во время тестирования: {e}")
    finally:
        db.close()
        print("\n--- Соединение с БД закрыто ---")