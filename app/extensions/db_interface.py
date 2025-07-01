import abc
from typing import List, Optional
from app.models.walk import Walk


class DBInterface(abc.ABC):

    @abc.abstractmethod
    def connect(self):
        """Establishes a connection to the database."""
        pass

    @abc.abstractmethod
    def close(self):
        """Closes the database connection."""
        pass

    @abc.abstractmethod
    def init_db(self):
        """Initializes the database schema (e.g., creates tables)."""
        pass

    @abc.abstractmethod
    def get_walks(self) -> List[Walk]:
        """Retrieves all walks from the database, ordered by date descending."""
        pass

    @abc.abstractmethod
    def get_walk_by_id(self, walk_id: int) -> Optional[Walk]:
        """Retrieves a single walk by its ID."""
        pass

    @abc.abstractmethod
    def add_walk(self, walk: Walk) -> int:
        """Adds a new walk to the database and returns its ID."""
        pass

    # @abc.abstractmethod
    # def update_walk(self, walk: Walk) -> None:
    #     """Updates an existing walk in the database."""
    #     pass
    #
    # @abc.abstractmethod
    # def delete_walk(self, walk_id: int) -> None:
    #     """Deletes a walk from the database by its ID."""
    #     pass
