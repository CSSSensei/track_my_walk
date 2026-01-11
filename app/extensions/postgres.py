import logging
import os
from typing import Any, Dict, List, Optional

from flask import current_app
from sqlalchemy import Column, Float, ForeignKey, Integer, JSON, String, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.orm.session import Session as OrmSession

from app.extensions.db_interface import DBInterface
from app.models.walk import Walk
from app.models.photo import Photo

logger = logging.getLogger(__name__)
Base = declarative_base()


def create_postgres_engine(db_config: Dict[str, Any]) -> Engine:
    db_config = {k: v for k, v in db_config.items() if v is not None}
    connection_string = (
        f"postgresql+pg8000://{db_config['user']}:{db_config['password']}@{db_config['host']}/{db_config['dbname']}"
    )
    return create_engine(connection_string)


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
    thumbnail_url = Column(String(255))

    walk = relationship("WalkModel", back_populates="photos")


class PostgresDB(DBInterface):
    @classmethod
    def open(cls, **kwargs) -> "PostgresDB":
        engine: Engine = kwargs["engine"]
        session_factory: sessionmaker[OrmSession] = kwargs["session_factory"]
        return cls(engine, session_factory)

    def close(self) -> None:
        return

    def __init__(self, engine: Engine, session_factory: sessionmaker[OrmSession]):
        self.engine = engine
        self.Session = session_factory
        self.upload_folder = current_app.config.get("UPLOAD_FOLDER", "app/static/uploads/photos")

    def _get_full_path_from_url(self, file_url: str) -> str:
        filename = os.path.basename(file_url)
        return os.path.join(current_app.root_path, self.upload_folder, filename)

    def init_db(self):
        try:
            Base.metadata.create_all(self.engine)
        except SQLAlchemyError:
            logger.exception("Failed to init DB schema")
            raise

    def get_walks(self) -> List[Walk]:
        session = self.Session()
        try:
            walks = session.query(WalkModel).order_by(WalkModel.date.desc()).all()
            return [
                Walk.from_postgres_row((w.id, w.name, w.date, w.description, w.path_geojson, w.distance, w.co2_saved))
                for w in walks
            ]
        except SQLAlchemyError:
            session.rollback()
            logger.exception("Failed to get walks")
            raise
        finally:
            session.close()

    def get_walk_by_id(self, walk_id: int) -> Optional[Walk]:
        session = self.Session()
        try:
            walk = session.query(WalkModel).filter_by(id=walk_id).first()
            if walk:
                return Walk.from_postgres_row(
                    (walk.id, walk.name, walk.date, walk.description, walk.path_geojson, walk.distance, walk.co2_saved)
                )
            return None
        except SQLAlchemyError:
            session.rollback()
            logger.exception("Failed to get walk by id=%s", walk_id)
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
                co2_saved=walk.co2_saved,
            )
            session.add(new_walk)
            session.commit()
            return new_walk.id
        except SQLAlchemyError:
            session.rollback()
            logger.exception("Failed to add walk")
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
        except SQLAlchemyError:
            session.rollback()
            logger.exception("Failed to update walk id=%s", walk.id)
            raise
        finally:
            session.close()

    def delete_walk(self, walk_id: int) -> bool:
        session = self.Session()
        try:
            walk = session.query(WalkModel).filter_by(id=walk_id).first()
            if walk:
                photos_to_delete = session.query(PhotoModel).filter_by(walk_id=walk.id).all()
                for photo in photos_to_delete:
                    if photo.url:
                        photo_path = self._get_full_path_from_url(photo.url)
                        if os.path.exists(photo_path):
                            try:
                                os.remove(photo_path)
                            except OSError as e:
                                logger.warning("Failed to delete file %s: %s", photo_path, e)

                    if photo.thumbnail_url:
                        thumb_path = self._get_full_path_from_url(photo.thumbnail_url)
                        if os.path.exists(thumb_path):
                            try:
                                os.remove(thumb_path)
                            except OSError as e:
                                logger.warning("Failed to delete thumbnail %s: %s", thumb_path, e)

                    session.delete(photo)

                session.delete(walk)
                session.commit()
                return True
            return False
        except SQLAlchemyError:
            session.rollback()
            logger.exception("Failed to delete walk id=%s", walk_id)
            raise
        except Exception:
            session.rollback()
            logger.exception("Unexpected error deleting walk id=%s", walk_id)
            raise
        finally:
            session.close()

    def add_photo(
        self, walk_id: int, url: str, description: Optional[str], latitude: float, longitude: float, thumbnail_url: str
    ) -> int:
        session = self.Session()
        try:
            new_photo: Photo = PhotoModel(
                walk_id=walk_id,
                url=url,
                description=description,
                latitude=latitude,
                longitude=longitude,
                thumbnail_url=thumbnail_url,
            )
            session.add(new_photo)
            session.commit()
            return new_photo.id
        except SQLAlchemyError:
            session.rollback()
            logger.exception("Failed to add photo for walk_id=%s", walk_id)
            raise
        finally:
            session.close()

    def get_photos_by_walk_id(self, walk_id: int) -> List[Photo]:
        session = self.Session()
        try:
            photos = session.query(PhotoModel).filter_by(walk_id=walk_id).order_by(PhotoModel.walk_id).all()
            return [
                Photo.from_postgres_row((p.id, p.walk_id, p.url, p.description, p.latitude, p.longitude, p.thumbnail_url))
                for p in photos
            ]
        except SQLAlchemyError:
            session.rollback()
            logger.exception("Failed to get photos for walk_id=%s", walk_id)
            raise
        finally:
            session.close()

    def delete_photo(self, photo_id: int) -> bool:
        session = self.Session()
        try:
            photo = session.query(PhotoModel).filter_by(id=photo_id).first()
            if photo:
                if photo.url:
                    photo_path = self._get_full_path_from_url(photo.url)
                    if os.path.exists(photo_path):
                        try:
                            os.remove(photo_path)
                        except OSError as e:
                            logger.warning("Failed to delete file %s: %s", photo_path, e)

                if photo.thumbnail_url:
                    thumb_path = self._get_full_path_from_url(photo.thumbnail_url)
                    if os.path.exists(thumb_path):
                        try:
                            os.remove(thumb_path)
                        except OSError as e:
                            logger.warning("Failed to delete thumbnail %s: %s", thumb_path, e)

                session.delete(photo)
                session.commit()
                return True
            return False
        except SQLAlchemyError:
            session.rollback()
            logger.exception("Failed to delete photo id=%s", photo_id)
            raise
        except Exception:
            session.rollback()
            logger.exception("Unexpected error deleting photo id=%s", photo_id)
            raise
        finally:
            session.close()
