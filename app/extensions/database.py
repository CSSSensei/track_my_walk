from app.extensions.db_interface import DBInterface
from app.extensions.sqlite_db import SQLiteDB
from app.extensions.postgres import PostgresDB
from flask import g, current_app


def get_db_interface() -> DBInterface:
    """
    Provides a database interface instance (e.g., SQLiteDB or PostgresDB) for the current request.
    Stores it in Flask's `g` object to reuse within the same request.
    """
    if 'db_interface' not in g:
        db_type = current_app.config.get('DATABASE_TYPE', 'postgres')
        if db_type == 'sqlite':
            db_instance = SQLiteDB()
        elif db_type == 'postgres':
            db_instance = PostgresDB()
        else:
            raise ValueError(f"Unknown database type: {db_type}")

        g.db_interface = db_instance
        g.db_interface.connect()
    return g.db_interface


def close_db_interface(e=None):
    """
    Closes the database interface connection at the end of a request.
    """
    db_interface = g.pop('db_interface', None)
    if db_interface is not None:
        db_interface.close()


def init_app(app):
    app.teardown_appcontext(close_db_interface)
    app.cli.add_command(app.cli.command('init-db')(init_db_command))


def init_db_command(app):
    """Clear existing data and create new tables."""
    with app.app_context():
        # Get an instance of the appropriate DB and initialize it
        db_type = app.config.get('DATABASE_TYPE', 'postgres')
        if db_type == 'sqlite':
            db_interface = SQLiteDB()
        elif db_type == 'postgres':
            db_interface = PostgresDB()
        else:
            raise ValueError(f"Unknown database type: {db_type}")

        db_interface.init_db()
        # No need to explicitly close here as it's a short-lived instance,
        # could add db_interface.close() if preferred for clarity.
        print(f'Initialized the {db_type} database.')
