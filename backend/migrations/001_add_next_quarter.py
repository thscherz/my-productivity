"""
Migration 001: this_half_year → next_quarter
Erstellt tasks-Tabelle mit neuem CHECK constraint neu, kopiert alle Daten.
Sichere Migration — Daten bleiben erhalten.
"""
import sqlite3
import sys
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "productivity.db")


def migrate():
    if not os.path.exists(DB_PATH):
        print("Keine Datenbank gefunden — Migration übersprungen.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = OFF")

    try:
        # 1. Bestehende Daten umschreiben: this_half_year → next_quarter
        conn.execute(
            "UPDATE tasks SET time_horizon = 'next_quarter' WHERE time_horizon = 'this_half_year'"
        )
        print("this_half_year → next_quarter migriert.")

        # 2. Prüfen ob die Tabelle den alten CHECK hat
        schema = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'"
        ).fetchone()

        if schema and "this_half_year" in schema[0]:
            print("Tabelle mit altem CHECK gefunden — erstelle neu...")

            # 3. Neue Tabelle erstellen mit aktualisiertem CHECK
            new_check = schema[0].replace("'this_half_year'", "'next_quarter'")
            # Temporäre Tabelle
            new_check = new_check.replace("CREATE TABLE tasks", "CREATE TABLE tasks_new", 1)

            conn.execute(new_check)

            # 4. Daten kopieren
            cols = [row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()]
            cols_str = ", ".join(cols)
            conn.execute(f"INSERT INTO tasks_new ({cols_str}) SELECT {cols_str} FROM tasks")

            # 5. Alte Tabelle löschen, neue umbenennen
            conn.execute("DROP TABLE tasks")
            conn.execute("ALTER TABLE tasks_new RENAME TO tasks")
            print("Tabelle neu erstellt mit next_quarter CHECK.")
        else:
            print("CHECK constraint bereits aktuell oder Tabelle nicht vorhanden.")

        conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()
        print("Migration 001 erfolgreich.")

    except Exception as e:
        conn.rollback()
        print(f"Migration fehlgeschlagen: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
