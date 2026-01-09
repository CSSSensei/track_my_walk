import click
from flask import current_app, g
from flask.cli import with_appcontext
from sqlalchemy.orm import sessionmaker

from app.extensions.db_interface import DBInterface
from app.extensions.postgres import PostgresDB, create_postgres_engine


def get_db_interface() -> DBInterface:
    if "db_interface" not in g:
        engine = current_app.extensions["db_engine"]
        session_factory = current_app.extensions["db_session_factory"]
        g.db_interface = PostgresDB(engine, session_factory)
    return g.db_interface


def close_db_interface(e=None):
    g.pop("db_interface", None)


@click.command("init-db")
@with_appcontext
def init_db_command():
    engine = current_app.extensions["db_engine"]
    session_factory = current_app.extensions["db_session_factory"]
    db = PostgresDB(engine, session_factory)
    db.init_db()
    click.echo("Initialized the postgres database.")


def init_app(app):
    engine = create_postgres_engine(app.config["POSTGRES_DATABASE"])
    app.extensions["db_engine"] = engine
    app.extensions["db_session_factory"] = sessionmaker(bind=engine)

    app.teardown_appcontext(close_db_interface)
    app.cli.add_command(init_db_command)
