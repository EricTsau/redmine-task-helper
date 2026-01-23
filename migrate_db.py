
import sqlite3
import os

db_path = "backend/data/redmine_flow.db"

if not os.path.exists(db_path):
    print(f"Database file not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE trackedtask ADD COLUMN status_id INTEGER")
    conn.commit()
    print("Migration successful: Added status_id column.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("Column status_id already exists.")
    else:
        print(f"Migration failed: {e}")
finally:
    conn.close()
