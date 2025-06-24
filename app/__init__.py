from flask import Flask
from config import Config
from app.extensions import database


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    database.init_db(app)

    from .routes import main, admin, api
    app.register_blueprint(main.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(api.bp)

    # Register close_db function to be called on app teardown
    app.teardown_appcontext(database.close_db)

    return app
