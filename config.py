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
