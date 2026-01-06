from flask import Flask, render_template
from config import Config
from app.extensions import database


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    database.init_app(app)

    from .routes import main, admin, api
    app.register_blueprint(main.bp)
    app.register_blueprint(admin.bp)
    app.register_blueprint(api.bp)

    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404

    return app
