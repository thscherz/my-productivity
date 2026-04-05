import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import KanbanBoard from "../components/kanban/KanbanBoard";
import TaskCreateModal from "../components/tasks/TaskCreateModal";
import TaskSidePanel from "../components/tasks/TaskSidePanel";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { tasksApi } from "../api/tasks";
import { projectsApi } from "../api/projects";
import { tagsApi } from "../api/tags";
import { VISIBLE_HORIZONS } from "../utils/constants";

// Haupt-Seite der App: Kanban-Board (ein View, keine Tabs)
export default function KanbanPage({ onLogout }) {
  const navigate = useNavigate();

  // Daten-State
  const [kanbanData, setKanbanData] = useState({ columns: {} });
  const [projects, setProjects] = useState([]);
  const [allTags, setAllTags] = useState([]);

  // UI-State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [defaultHorizon, setDefaultHorizon] = useState("today");

  // Sidebar-State: geöffnete Task-ID (null = geschlossen)
  const [sidebarTaskId, setSidebarTaskId] = useState(null);

  // Filter-State (tag_ids und priority werden client-side gefiltert)
  const [filters, setFilters] = useState({
    project_id: "",
    status: "",
    search: "",
    priority: "",
    tag_ids: [],
  });

  // Abgeschlossene Arbeitspakete ausblenden (Standard: true)
  const [hideCompletedWP, setHideCompletedWP] = useState(true);

  // Kanban-Daten laden
  const fetchKanban = useCallback(async () => {
    try {
      const data = await tasksApi.getKanban(filters);
      setKanbanData(data);
      setError("");
    } catch (err) {
      setError(err.detail || "Fehler beim Laden der Tasks.");
    }
  }, [filters]);

  // Projekte + Tags laden
  const fetchProjects = useCallback(async () => {
    try { setProjects(await projectsApi.getAll()); } catch { /* optional */ }
  }, []);
  const fetchTags = useCallback(async () => {
    try { setAllTags(await tagsApi.getAll()); } catch { /* optional */ }
  }, []);

  // Initial laden
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchKanban(), fetchProjects(), fetchTags()]);
      setLoading(false);
    };
    init();
  }, []);

  // Neu laden wenn Filter sich ändern (aber nicht beim ersten Render)
  const isFirstRender = useState(true);
  useEffect(() => {
    if (isFirstRender[0]) {
      isFirstRender[1](false);
      return;
    }
    fetchKanban();
  }, [filters, fetchKanban]);

  // Task als erledigt/offen toggeln
  const handleToggleDone = async (task) => {
    const newStatus = task.status === "done" ? "open" : "done";
    try {
      await tasksApi.update(task.id, { ...task, status: newStatus });
      await fetchKanban(); // await damit Board nach Update sofort aktualisiert wird
    } catch (err) {
      console.error("Fehler beim Status-Update:", err);
    }
  };

  // Neuen Task erstellen — Modal öffnen
  const handleCreateTask = (horizon = "today") => {
    setDefaultHorizon(horizon);
    setCreateModalOpen(true);
  };

  // Task-Klick → Sidebar öffnen statt zur Detailseite navigieren
  const handleOpenSidebar = useCallback((pathOrId) => {
    // pathOrId kann "/task/123" (von TaskCard) oder eine reine ID (number) sein
    if (typeof pathOrId === "string" && pathOrId.startsWith("/task/")) {
      const id = parseInt(pathOrId.replace("/task/", ""), 10);
      setSidebarTaskId(id);
    } else if (typeof pathOrId === "number") {
      setSidebarTaskId(pathOrId);
    }
  }, []);

  // Sidebar schliessen
  const handleCloseSidebar = useCallback(() => {
    setSidebarTaskId(null);
  }, []);

  // Keyboard Shortcut: "t" öffnet Task-Erstellen-Modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (createModalOpen) return;
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        handleCreateTask("today");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [createModalOpen]);

  // Client-Side-Filtering für Priority, Tags und abgeschlossene Arbeitspakete
  const cols = kanbanData.columns || {};

  // Spaltenübergreifende Map: WP-ID → Status (für Subtask-Filterung)
  // Muss vor der Spalten-Iteration gebaut werden
  const wpStatusMap = {};
  if (hideCompletedWP) {
    for (const col of Object.values(cols)) {
      for (const task of col.tasks || []) {
        if (task.is_work_package) {
          wpStatusMap[String(task.id)] = task.status;
        }
      }
    }
  }

  const filteredColumns = {};
  for (const [horizon, col] of Object.entries(cols)) {
    let tasks = col.tasks || [];
    if (filters.priority) {
      tasks = tasks.filter((t) => t.priority === filters.priority);
    }
    if (filters.tag_ids && filters.tag_ids.length > 0) {
      tasks = tasks.filter((t) =>
        filters.tag_ids.every((tagId) => t.tags?.some((tag) => tag.id === tagId))
      );
    }
    // Abgeschlossene Arbeitspakete und deren Subtasks ausblenden
    if (hideCompletedWP) {
      // Erledigte/abgebrochene WPs selbst entfernen
      tasks = tasks.filter(
        (t) => !(t.is_work_package && (t.status === "done" || t.status === "cancelled"))
      );
      // Subtasks entfernen, deren Parent-WP erledigt/abgebrochen ist
      // (spaltenübergreifend — Parent kann in anderer Spalte liegen)
      tasks = tasks.filter((t) => {
        if (!t.parent_id) return true; // Top-Level Tasks immer behalten
        const parentStatus = wpStatusMap[String(t.parent_id)];
        if (!parentStatus) return true; // Parent unbekannt → behalten
        return parentStatus !== "done" && parentStatus !== "cancelled";
      });
    }
    filteredColumns[horizon] = { tasks };
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Layout
      projects={projects}
      tags={allTags}
      filters={filters}
      onFilterChange={setFilters}
      onCreateTask={() => handleCreateTask("today")}
      onLogout={onLogout}
      hideCompletedWP={hideCompletedWP}
      onToggleHideCompletedWP={() => setHideCompletedWP((v) => !v)}
    >
      {/* Fehler-Banner */}
      {error && (
        <div className="mx-4 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
          <button onClick={fetchKanban} className="ml-2 underline hover:no-underline">
            Erneut laden
          </button>
        </div>
      )}

      {/* Kanban-Board — bei geöffneter Sidebar etwas schmäler auf Desktop (ab lg, darunter Overlay) */}
      <div className={`h-full transition-all duration-300 ${sidebarTaskId ? "lg:mr-[420px]" : ""}`}>
        <KanbanBoard
          columns={filteredColumns}
          horizons={VISIBLE_HORIZONS}
          onToggleDone={handleToggleDone}
          onRefetch={fetchKanban}
          onNavigate={handleOpenSidebar}
        />
      </div>

      {/* Task-Schnellansicht als Sidebar — isModalOpen verhindert ESC-Konflikt (HINWEIS-02) */}
      <TaskSidePanel
        taskId={sidebarTaskId}
        projects={projects}
        onClose={handleCloseSidebar}
        onRefetch={fetchKanban}
        onOpenFull={(id) => navigate(`/task/${id}`)}
        isModalOpen={createModalOpen}
      />

      {/* FAB auf Mobile */}
      <button
        onClick={() => handleCreateTask("today")}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-colors md:hidden"
        aria-label="Neuer Task"
      >
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Task-Erstellungs-Modal */}
      <TaskCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={fetchKanban}
        projects={projects}
        defaultHorizon={defaultHorizon}
      />
    </Layout>
  );
}
