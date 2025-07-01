from flask import Flask
from app.extensions.database import close_db_interface, init_db_command
from config import Config
from app.extensions import database


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    init_db_command(app)
    # Register the teardown function for closing the DB connection
    app.teardown_appcontext(close_db_interface)
    # Register a CLI command to initialize the database
    app.cli.add_command(app.cli.command('init-db')(lambda: init_db_command(app)))

    from .routes import main, admin, api
    app.register_blueprint(main.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(api.bp)

    return app
