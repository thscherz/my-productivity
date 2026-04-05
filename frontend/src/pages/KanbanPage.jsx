import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import KanbanBoard from "../components/kanban/KanbanBoard";
import TaskCreateModal from "../components/tasks/TaskCreateModal";
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

  // Filter-State (tag_ids und priority werden client-side gefiltert)
  const [filters, setFilters] = useState({
    project_id: "",
    status: "",
    search: "",
    priority: "",
    tag_ids: [],
  });

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
      fetchKanban();
    } catch (err) {
      console.error("Fehler beim Status-Update:", err);
    }
  };

  // Neuen Task erstellen — Modal öffnen
  const handleCreateTask = (horizon = "today") => {
    setDefaultHorizon(horizon);
    setCreateModalOpen(true);
  };

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

  // Client-Side-Filtering für Priority und Tags
  const filteredColumns = {};
  const cols = kanbanData.columns || {};
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

      {/* Kanban-Board */}
      <KanbanBoard
        columns={filteredColumns}
        horizons={VISIBLE_HORIZONS}
        onToggleDone={handleToggleDone}
        onRefetch={fetchKanban}
        onNavigate={navigate}
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
