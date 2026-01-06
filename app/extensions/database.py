import click
from flask import g
from flask.cli import with_appcontext

from app.extensions.db_interface import DBInterface
from app.extensions.postgres import PostgresDB


def get_db_interface() -> DBInterface:
    if "db_interface" not in g:
        g.db_interface = PostgresDB()
    return g.db_interface


def close_db_interface(e=None):
    db_interface = g.pop("db_interface", None)
    if db_interface is not None:
        db_interface.close()


@click.command("init-db")
@with_appcontext
def init_db_command():
    db = PostgresDB()
    db.init_db()
    click.echo("Initialized the postgres database.")


def init_app(app):
    app.teardown_appcontext(close_db_interface)
    app.cli.add_command(init_db_command)
