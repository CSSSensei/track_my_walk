import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).parent
env_path = BASE_DIR / '.env'
load_dotenv(env_path)
INSTANCE_DIR = BASE_DIR / 'instance'
INSTANCE_DIR.mkdir(exist_ok=True)  # Создаем папку, если нет папки instance

project_root = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(project_root, 'app', 'static', 'uploads', 'photos')


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'default_secret_key')
    API_KEY = os.getenv('API_KEY')
    SQLITE_DATABASE = str(INSTANCE_DIR / 'walks.db')
    POSTGRES_DATABASE = {
        'dbname': os.getenv('POSTGRESQL_DB_NAME'),
        'user': os.getenv('POSTGRESQL_USER'),
        'password': os.getenv('POSTGRESQL_PASSWORD'),
        'host': os.getenv('POSTGRESQL_HOST'),
    }
    UPLOAD_FOLDER = UPLOAD_FOLDER
    ADMIN_USERNAME = os.getenv('ADMIN_USERNAME')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')
    DATABASE_TYPE = os.getenv('DATABASE_TYPE', 'postgres')  # 'sqlite' или 'postgres'
    THUMBNAIL_PROFILES = {
        'micro': {
            'size': (50, 50),       # Для иконок в списках
            'prefix': 'micro_',
            'quality': 70,
            'format': 'JPEG',
            'suffix': '_50x50'      # Можно использовать для генерации URL
        },
        'small': {
            'size': (150, 150),     # Для миниатюр на карте
            'prefix': 'small_',
            'quality': 80,
            'format': 'JPEG',
            'suffix': '_150x150'
        },
        'medium': {
            'size': (300, 300),     # Для предпросмотра
            'prefix': 'medium_',
            'quality': 85,
            'format': 'JPEG',
            'suffix': '_300x300'
        },
        'large': {
            'size': (800, 800),     # Для модальных окон
            'prefix': 'large_',
            'quality': 90,
            'format': 'JPEG',
            'suffix': '_800x800'
        }
    }
    DEFAULT_THUMBNAIL_PROFILE = 'small'
    ORS_API_KEY = os.getenv('ORS_API_KEY')
