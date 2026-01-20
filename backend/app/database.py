from sqlmodel import SQLModel, create_engine, Session
import os

sqlite_file_name = "data/redmine_flow.db"
# Check if the directory exists, if not create it
os.makedirs(os.path.dirname(sqlite_file_name), exist_ok=True)

sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
