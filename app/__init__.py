from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, render_template

from app.extensions import database


def create_app():
    root_dir = Path(__file__).resolve().parent.parent
    load_dotenv(root_dir / ".env")

    (root_dir / "instance").mkdir(exist_ok=True)

    from config import Config

    app = Flask(__name__)
    app.config.from_object(Config)

    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY is not configured")

    database.init_app(app)

    from .routes import admin, api, main

    app.register_blueprint(main.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(api.bp)

    @app.errorhandler(404)
    def page_not_found(e):
        return render_template("404.html"), 404

    return app
