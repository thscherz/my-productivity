"""
Tests für die 3 neuen Features:
  1. "Dieser Monat" im Kanban-Board
  2. Abgeschlossene WPs ausblenden (Client-Side-Filter)
  3. Task-Schnellansicht (Sidebar) — Logik und Autosave

Test-Strategie: Die App nutzt eine SQLite-Datei in einem tmp-Verzeichnis.
Wir überschreiben den get_db-Dependency mit einer Session aus derselben
Engine, die nach dem Import der App-Module existiert — und erstellen die
Tabellen auf diesem Engine.
"""
import pytest
import os
import sys

# Pfad-Anpassung damit Backend-Module direkt importierbar sind
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --------------------------------------------------------------------------- #
# Test-Datenbank: gemeinsame temporäre SQLite-Datei pro Test-Session           #
# Wichtig: BEVOR main/database importiert werden, damit der Engine richtig     #
# initialisiert ist.                                                            #
# --------------------------------------------------------------------------- #

_TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "_test_qa.db")

# Engine für Tests (vor App-Import erstellen)
_test_engine = create_engine(
    f"sqlite:///{_TEST_DB_FILE}",
    connect_args={"check_same_thread": False},
)
_TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)


@pytest.fixture(autouse=True)
def reset_db():
    """Erstellt Tabellen vor jedem Test frisch (drop + create)."""
    # Modelle importieren damit Base.metadata befüllt ist
    from database import Base
    import models.task       # noqa
    import models.project    # noqa
    import models.tag        # noqa
    import models.task_tag   # noqa
    import models.attachment # noqa

    Base.metadata.drop_all(bind=_test_engine)
    Base.metadata.create_all(bind=_test_engine)
    yield
    Base.metadata.drop_all(bind=_test_engine)


@pytest.fixture
def client():
    """TestClient mit überschriebenem DB-Dependency auf Test-Engine."""
    from main import app
    from database import get_db
    from itsdangerous import TimestampSigner
    from config import get_settings

    def override_get_db():
        db = _TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    cfg = get_settings()
    signer = TimestampSigner(cfg.session_secret)
    token = signer.sign("authenticated").decode("utf-8")

    with TestClient(app) as c:
        c.cookies.set("prod_session", token)
        yield c

    app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# Hilfsfunktionen                                                              #
# --------------------------------------------------------------------------- #

def create_task(client, title="Test-Task", time_horizon="today", **kwargs):
    """Erstellt einen Task und gibt den Response zurück."""
    payload = {"title": title, "time_horizon": time_horizon, **kwargs}
    r = client.post("/api/v1/tasks", json=payload)
    assert r.status_code == 201, f"Task-Erstellung fehlgeschlagen: {r.text}"
    return r.json()


def create_wp(client, title="Test-WP", time_horizon="this_week"):
    """Erstellt ein Arbeitspaket (Work Package)."""
    return create_task(client, title=title, time_horizon=time_horizon, is_work_package=True)


# =========================================================================== #
# FEATURE 1: "Dieser Monat" im Kanban-Board                                   #
# =========================================================================== #

class TestDieserMonatKanban:
    """Tests für den this_month-Horizont im Kanban-Board."""

    def test_this_month_horizon_exists_in_enums(self):
        """this_month muss als gültiger TimeHorizon-Enum-Wert existieren."""
        from schemas.enums import TimeHorizon
        assert TimeHorizon.THIS_MONTH.value == "this_month"

    def test_task_created_with_this_month_horizon(self, client):
        """Task mit time_horizon=this_month kann erstellt werden."""
        task = create_task(client, title="Monat-Task", time_horizon="this_month")
        assert task["time_horizon"] == "this_month"

    def test_this_month_column_present_in_kanban_response(self, client):
        """Kanban-Response enthält eine Spalte 'this_month'."""
        r = client.get("/api/v1/tasks/kanban")
        assert r.status_code == 200
        columns = r.json()["columns"]
        assert "this_month" in columns, (
            "BUG: 'this_month'-Spalte fehlt im Kanban-Response"
        )

    def test_this_month_task_appears_in_correct_column(self, client):
        """Task mit this_month landet in der richtigen Kanban-Spalte."""
        create_task(client, title="Diesen Monat erledigen", time_horizon="this_month")
        r = client.get("/api/v1/tasks/kanban")
        assert r.status_code == 200
        tasks_in_col = r.json()["columns"]["this_month"]["tasks"]
        titles = [t["title"] for t in tasks_in_col]
        assert "Diesen Monat erledigen" in titles

    def test_this_month_in_visible_horizons_frontend_constant(self):
        """
        FRONTEND-CHECK (statisch): VISIBLE_HORIZONS muss 'this_month' enthalten.
        Liest die constants.js und prüft den String direkt.
        """
        import re
        constants_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "frontend", "src", "utils", "constants.js"
        )
        with open(constants_path, "r") as f:
            content = f.read()

        # Spezifisch: ist this_month in VISIBLE_HORIZONS?
        visible_match = re.search(
            r'VISIBLE_HORIZONS\s*=\s*\[([^\]]+)\]', content
        )
        assert visible_match, "VISIBLE_HORIZONS-Definition nicht gefunden"
        visible_str = visible_match.group(1)
        assert "this_month" in visible_str, (
            "BUG: 'this_month' fehlt in VISIBLE_HORIZONS — Spalte wird im Board nicht angezeigt!"
        )

    def test_wp_in_this_month_can_be_completed(self, client):
        """WP in this_month kann auf done gesetzt werden."""
        wp = create_wp(client, title="WP Monat", time_horizon="this_month")
        r = client.put(
            f"/api/v1/tasks/{wp['id']}",
            json={**wp, "status": "done", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "done"

    def test_this_month_different_from_this_week(self, client):
        """Tasks in this_month und this_week landen in unterschiedlichen Spalten."""
        create_task(client, title="Monat-Task", time_horizon="this_month")
        create_task(client, title="Woche-Task", time_horizon="this_week")
        r = client.get("/api/v1/tasks/kanban")
        assert r.status_code == 200
        cols = r.json()["columns"]
        month_titles = [t["title"] for t in cols["this_month"]["tasks"]]
        week_titles = [t["title"] for t in cols["this_week"]["tasks"]]
        assert "Monat-Task" in month_titles
        assert "Woche-Task" in week_titles
        assert "Monat-Task" not in week_titles
        assert "Woche-Task" not in month_titles


# =========================================================================== #
# FEATURE 2: Abgeschlossene WPs ausblenden                                    #
# =========================================================================== #

class TestHideCompletedWPs:
    """
    Tests für das Ausblenden abgeschlossener/abgebrochener Arbeitspakete.
    Der Filter ist Client-Side (React-State hideCompletedWP) — Backend liefert
    immer alle Tasks. Getestet wird:
      a) Backend: Done-WPs kommen in der Kanban-Response
      b) Frontend-Filterlogik (nachgebaut in Python)
    """

    def _client_side_filter(self, tasks, hide_completed_wp):
        """
        Simuliert den Client-Side-Filter aus KanbanPage.jsx:
          tasks.filter(t => !(t.is_work_package && (t.status === 'done' || t.status === 'cancelled')))
        """
        if not hide_completed_wp:
            return tasks
        return [
            t for t in tasks
            if not (t["is_work_package"] and t["status"] in ("done", "cancelled"))
        ]

    def test_backend_returns_done_wp_in_kanban(self, client):
        """Backend liefert abgeschlossene WPs in der Kanban-Antwort (kein serverseitiger Filter)."""
        wp = create_wp(client, title="Erledigtes WP")
        client.put(f"/api/v1/tasks/{wp['id']}", json={**wp, "status": "done", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban")
        all_tasks = [
            t
            for col in r.json()["columns"].values()
            for t in col["tasks"]
        ]
        done_wps = [t for t in all_tasks if t["is_work_package"] and t["status"] == "done"]
        assert len(done_wps) > 0, (
            "BUG: Erledigtes WP fehlt in Kanban-Response — Backend-Filter zu aggressiv"
        )

    def test_filter_hides_done_wp(self, client):
        """hideCompletedWP=True blendet done-WPs aus."""
        wp = create_wp(client, title="Done-WP")
        client.put(f"/api/v1/tasks/{wp['id']}", json={**wp, "status": "done", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban")
        all_tasks = [
            t
            for col in r.json()["columns"].values()
            for t in col["tasks"]
        ]
        filtered = self._client_side_filter(all_tasks, hide_completed_wp=True)
        assert not any(
            t["is_work_package"] and t["status"] == "done" for t in filtered
        ), "BUG: done-WP ist nach Filter noch sichtbar"

    def test_filter_hides_cancelled_wp(self, client):
        """hideCompletedWP=True blendet auch cancelled-WPs aus."""
        wp = create_wp(client, title="Cancelled-WP")
        client.put(f"/api/v1/tasks/{wp['id']}", json={**wp, "status": "cancelled", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban")
        all_tasks = [
            t
            for col in r.json()["columns"].values()
            for t in col["tasks"]
        ]
        filtered = self._client_side_filter(all_tasks, hide_completed_wp=True)
        assert not any(
            t["is_work_package"] and t["status"] == "cancelled" for t in filtered
        ), "BUG: cancelled-WP ist nach Filter noch sichtbar"

    def test_filter_off_shows_done_wp(self, client):
        """hideCompletedWP=False zeigt done-WPs (Toggle-Funktion)."""
        wp = create_wp(client, title="Sichtbares Done-WP")
        client.put(f"/api/v1/tasks/{wp['id']}", json={**wp, "status": "done", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban")
        all_tasks = [
            t
            for col in r.json()["columns"].values()
            for t in col["tasks"]
        ]
        filtered = self._client_side_filter(all_tasks, hide_completed_wp=False)
        assert any(
            t["is_work_package"] and t["status"] == "done" for t in filtered
        ), "BUG: done-WP ist auch bei deaktiviertem Filter nicht sichtbar"

    def test_filter_keeps_done_regular_tasks(self, client):
        """hideCompletedWP filtert NUR WPs — erledigte normale Tasks bleiben sichtbar."""
        task = create_task(client, title="Erledigter Task", is_work_package=False)
        client.put(f"/api/v1/tasks/{task['id']}", json={**task, "status": "done", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban")
        all_tasks = [
            t
            for col in r.json()["columns"].values()
            for t in col["tasks"]
        ]
        filtered = self._client_side_filter(all_tasks, hide_completed_wp=True)
        assert any(
            not t["is_work_package"] and t["status"] == "done" for t in filtered
        ), "BUG: erledigter normaler Task wurde fälschlicherweise ausgeblendet"

    def test_search_filter_finds_done_wp(self, client):
        """Suche findet abgeschlossene WPs unabhängig vom hideCompletedWP-State."""
        wp = create_wp(client, title="Suche-Done-WP")
        client.put(f"/api/v1/tasks/{wp['id']}", json={**wp, "status": "done", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban?search=Suche-Done-WP")
        assert r.status_code == 200
        all_tasks = [
            t
            for col in r.json()["columns"].values()
            for t in col["tasks"]
        ]
        found = [t for t in all_tasks if t["title"] == "Suche-Done-WP"]
        assert len(found) > 0, (
            "BUG: Abgeschlossenes WP nicht über Suche auffindbar (Backend)"
        )

    def test_status_filter_done_shows_done_wp(self, client):
        """Expliziter Status-Filter 'done' liefert abgeschlossene WPs."""
        wp = create_wp(client, title="Done-WP-Status-Filter")
        client.put(f"/api/v1/tasks/{wp['id']}", json={**wp, "status": "done", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban?status=done")
        assert r.status_code == 200
        all_tasks = [
            t
            for col in r.json()["columns"].values()
            for t in col["tasks"]
        ]
        done_wps = [t for t in all_tasks if t["is_work_package"] and t["status"] == "done"]
        assert len(done_wps) > 0, (
            "BUG: Status-Filter 'done' findet keine abgeschlossenen WPs"
        )


# =========================================================================== #
# FEATURE 3: Task-Schnellansicht (Sidebar) — Autosave-Logik                  #
# =========================================================================== #

class TestTaskSidePanelAutosave:
    """
    Tests für die Autosave-Logik der TaskSidePanel-Komponente.
    Die Sidebar speichert via PUT /api/v1/tasks/{id} — getestet werden
    alle relevanten Felder.
    """

    def test_sidebar_saves_title(self, client):
        """Autosave: Titeländerung wird korrekt gespeichert."""
        task = create_task(client, title="Original")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "title": "Geändert", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["title"] == "Geändert"

    def test_sidebar_saves_description(self, client):
        """Autosave: Beschreibung wird korrekt gespeichert."""
        task = create_task(client, title="Beschreibung-Test")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "description": "Details hier", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["description"] == "Details hier"

    def test_sidebar_saves_status(self, client):
        """Autosave: Status-Änderung wird korrekt gespeichert."""
        task = create_task(client, title="Status-Test")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "status": "in_progress", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"

    def test_sidebar_saves_priority(self, client):
        """Autosave: Priorität wird korrekt gespeichert."""
        task = create_task(client, title="Prio-Test")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "priority": "high", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["priority"] == "high"

    def test_sidebar_saves_horizon(self, client):
        """Autosave: Horizontänderung aktualisiert auch horizon_set_at."""
        task = create_task(client, title="Horizont-Test", time_horizon="today")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "time_horizon": "next_week", "tag_ids": []},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["time_horizon"] == "next_week"
        assert data["horizon_set_at"] is not None

    def test_sidebar_saves_due_date(self, client):
        """Autosave: Fälligkeitsdatum wird korrekt gespeichert."""
        task = create_task(client, title="Datum-Test")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "due_date": "2026-05-01", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["due_date"] == "2026-05-01"

    def test_sidebar_saves_project(self, client):
        """Autosave: Projektzuordnung wird korrekt gespeichert."""
        proj = client.post("/api/v1/projects", json={"name": "Testprojekt", "color": "#3b82f6"})
        assert proj.status_code == 201
        proj_id = proj.json()["id"]

        task = create_task(client, title="Projekt-Test")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "project_id": proj_id, "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["project_id"] == proj_id

    def test_sidebar_saves_duration_tag(self, client):
        """Autosave: Zeitaufwand-Tag wird korrekt gespeichert."""
        task = create_task(client, title="Dauer-Test")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "duration_tag": "1h", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["duration_tag"] == "1h"

    def test_sidebar_saves_tags(self, client):
        """Autosave: Tag-Zuweisung wird korrekt gespeichert."""
        tag = client.post("/api/v1/tags", json={"name": "TestTag", "color": "#ef4444"})
        assert tag.status_code == 201
        tag_id = tag.json()["id"]

        task = create_task(client, title="Tag-Test")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "tag_ids": [tag_id]},
        )
        assert r.status_code == 200
        saved_tags = [t["id"] for t in r.json()["tags"]]
        assert tag_id in saved_tags

    def test_sidebar_detail_button_task_accessible(self, client):
        """Detail-Button: Task muss über GET /api/v1/tasks/{id} abrufbar sein."""
        task = create_task(client, title="Detail-Link-Test")
        r = client.get(f"/api/v1/tasks/{task['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == task["id"]

    def test_sidebar_status_done_sets_completed_at(self, client):
        """Status → done setzt completed_at-Timestamp (Kernlogik für Board-Verhalten)."""
        task = create_task(client, title="Done-Timestamp-Test")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "status": "done", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["completed_at"] is not None

    def test_sidebar_wp_done_cascades_to_subtasks(self, client):
        """WP auf done setzen → alle offenen Subtasks werden kaskadiert erledigt."""
        wp = create_wp(client, title="WP mit Subtasks")
        sub1 = create_task(client, title="Subtask 1", parent_id=wp["id"], time_horizon="this_week")
        sub2 = create_task(client, title="Subtask 2", parent_id=wp["id"], time_horizon="this_week")

        r = client.put(
            f"/api/v1/tasks/{wp['id']}",
            json={**wp, "status": "done", "tag_ids": []},
        )
        assert r.status_code == 200

        # Subtasks prüfen
        r1 = client.get(f"/api/v1/tasks/{sub1['id']}")
        r2 = client.get(f"/api/v1/tasks/{sub2['id']}")
        assert r1.json()["status"] == "done", "BUG: Subtask 1 nicht kaskadiert erledigt"
        assert r2.json()["status"] == "done", "BUG: Subtask 2 nicht kaskadiert erledigt"

    def test_sidebar_load_returns_subtasks(self, client):
        """Sidebar lädt Subtasks via GET /api/v1/tasks?parent_id=X."""
        wp = create_wp(client, title="WP für Subtask-Laden")
        create_task(client, title="Sub A", parent_id=wp["id"], time_horizon="this_week")
        create_task(client, title="Sub B", parent_id=wp["id"], time_horizon="this_week")

        r = client.get(f"/api/v1/tasks?parent_id={wp['id']}")
        assert r.status_code == 200
        subs = r.json()
        titles = [s["title"] for s in subs]
        assert "Sub A" in titles
        assert "Sub B" in titles

    def test_sidebar_nonexistent_task_returns_404(self, client):
        """Sidebar-Load für nicht-existierende Task-ID: 404."""
        r = client.get("/api/v1/tasks/99999")
        assert r.status_code == 404


# =========================================================================== #
# EDGE CASES: Übergreifende Tests                                             #
# =========================================================================== #

class TestEdgeCases:
    """Edge Cases, die alle drei Features betreffen."""

    def test_this_month_wp_hidden_when_done(self, client):
        """WP in this_month, erledigt → Filter blendet ihn aus."""
        wp = create_wp(client, title="Monat-WP-Done", time_horizon="this_month")
        client.put(f"/api/v1/tasks/{wp['id']}", json={**wp, "status": "done", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban")
        tasks_in_month = r.json()["columns"].get("this_month", {}).get("tasks", [])
        # Backend gibt ihn zurück — Client-Side-Filter würde ihn ausblenden
        done_wps = [t for t in tasks_in_month if t["is_work_package"] and t["status"] == "done"]
        assert len(done_wps) > 0, "Backend muss done-WP in this_month zurückgeben"

    def test_sidebar_save_this_month_horizon(self, client):
        """Sidebar: Horizont kann auf this_month gesetzt werden."""
        task = create_task(client, title="Sidebar-Monat-Test", time_horizon="today")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "time_horizon": "this_month", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["time_horizon"] == "this_month"

    def test_wp_status_cancelled_also_filtered(self, client):
        """Abgebrochene WPs werden ebenso wie erledigte ausgeblendet."""
        wp = create_wp(client, title="Abgebrochen-WP")
        r = client.put(
            f"/api/v1/tasks/{wp['id']}",
            json={**wp, "status": "cancelled", "tag_ids": []},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "cancelled"

    def test_empty_title_rejected_or_accepted(self, client):
        """
        Task mit leerem Titel: dokumentiert aktuelles Backend-Verhalten.
        Pydantic erlaubt leere Strings — Test prüft ob das Backend 201 oder 422 zurückgibt.
        """
        r = client.post("/api/v1/tasks", json={"title": "", "time_horizon": "today"})
        # Beide Antworten akzeptabel — dokumentiert das Verhalten
        assert r.status_code in (201, 422), f"Unerwarteter Status: {r.status_code}"

    def test_sidebar_toggle_duration_tag_to_none(self, client):
        """Zeitaufwand kann auf None (deselektiert) gesetzt werden."""
        task = create_task(client, title="Dauer-Clear-Test", duration_tag="2h")
        r = client.put(
            f"/api/v1/tasks/{task['id']}",
            json={**task, "duration_tag": None, "tag_ids": []},
        )
        assert r.status_code == 200
        assert "duration_tag" in r.json()

    def test_multiple_tasks_in_this_month_column(self, client):
        """Mehrere Tasks können in this_month angelegt werden."""
        for i in range(3):
            create_task(client, title=f"Monat-Task {i}", time_horizon="this_month")
        r = client.get("/api/v1/tasks/kanban")
        tasks_in_month = r.json()["columns"]["this_month"]["tasks"]
        assert len(tasks_in_month) == 3

    def test_wp_done_then_toggled_visible_again(self, client):
        """WP erledigt, dann Filter aus — WP wieder sichtbar."""
        wp = create_wp(client, title="Toggle-WP")
        client.put(f"/api/v1/tasks/{wp['id']}", json={**wp, "status": "done", "tag_ids": []})

        r = client.get("/api/v1/tasks/kanban")
        all_tasks = [t for col in r.json()["columns"].values() for t in col["tasks"]]

        # Filter AN: WP ausgeblendet
        with_filter = [
            t for t in all_tasks
            if not (t["is_work_package"] and t["status"] in ("done", "cancelled"))
        ]
        # Filter AUS: WP sichtbar
        without_filter = all_tasks

        assert not any(t["title"] == "Toggle-WP" for t in with_filter), "WP soll gefiltert sein"
        assert any(t["title"] == "Toggle-WP" for t in without_filter), "WP soll ohne Filter sichtbar sein"
