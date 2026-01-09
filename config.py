import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
ENV_PATH = BASE_DIR / ".env"
INSTANCE_DIR = BASE_DIR / "instance"
UPLOAD_FOLDER = str(BASE_DIR / "app" / "static" / "uploads" / "photos")


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    DEBUG = _env_bool("FLASK_DEBUG", False)

    SECRET_KEY = os.getenv("SECRET_KEY")
    API_KEY = os.getenv("API_KEY")

    SQLITE_DATABASE = os.getenv("SQLITE_DATABASE", str(INSTANCE_DIR / "walks.db"))
    POSTGRES_DATABASE = {
        "dbname": os.getenv("POSTGRESQL_DB_NAME"),
        "user": os.getenv("POSTGRESQL_USER"),
        "password": os.getenv("POSTGRESQL_PASSWORD"),
        "host": os.getenv("POSTGRESQL_HOST"),
    }

    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", UPLOAD_FOLDER)

    ADMIN_USERNAME = os.getenv("ADMIN_USERNAME")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = _env_bool("SESSION_COOKIE_SECURE", default=not DEBUG)

    PHOTO_FORMAT = "WEBP"
    PHOTO_QUALITY = 82

    THUMBNAIL_PROFILES = {
        "micro": {
            "size": (50, 50),
            "prefix": "micro_",
            "quality": 70,
            "format": "WEBP",
            "suffix": "_50x50",
        },
        "small": {
            "size": (150, 150),
            "prefix": "small_",
            "quality": 80,
            "format": "WEBP",
            "suffix": "_150x150",
        },
        "medium": {
            "size": (300, 300),
            "prefix": "medium_",
            "quality": 85,
            "format": "WEBP",
            "suffix": "_300x300",
        },
        "large": {
            "size": (800, 800),
            "prefix": "large_",
            "quality": 90,
            "format": "WEBP",
            "suffix": "_800x800",
        },
    }
    DEFAULT_THUMBNAIL_PROFILE = "small"
    ORS_API_KEY = os.getenv("ORS_API_KEY")
