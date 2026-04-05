import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { PRIORITY_LABELS } from "../../utils/constants";

// Haupt-Layout mit Top-Bar, Filtern und Inhaltsbereich
export default function Layout({
  children,
  projects = [],
  tags = [],
  filters = {},
  onFilterChange,
  onCreateTask,
  onLogout,
}) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState(filters.search || "");

  let searchTimeout = null;
  const handleSearchChange = (value) => {
    setSearchValue(value);
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      onFilterChange?.({ ...filters, search: value });
    }, 300);
  };

  // Tag-Filter toggeln (Mehrfachauswahl)
  const toggleTagFilter = (tagId) => {
    const current = filters.tag_ids || [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onFilterChange?.({ ...filters, tag_ids: updated });
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout", {});
    } catch { /* ignore */ }
    onLogout?.();
  };

  const activeTagIds = filters.tag_ids || [];

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: "#F5F4F2" }}>
      {/* Top-Bar */}
      <header className="z-20 flex items-center gap-3 px-4 py-2.5 shadow-md" style={{ backgroundColor: "#1E3A5F" }}>
        {/* App-Titel */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 font-bold text-white text-lg tracking-tight shrink-0 hover:opacity-80 transition-opacity"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="hidden sm:inline">myProductivity</span>
        </button>

        {/* Desktop-Filter */}
        <div className="hidden md:flex items-center gap-2 flex-1">
          {/* Projekt */}
          <select
            value={filters.project_id || ""}
            onChange={(e) => onFilterChange?.({ ...filters, project_id: e.target.value })}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/50"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <option value="" style={{ backgroundColor: "#1E3A5F" }}>Alle Projekte</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id} style={{ backgroundColor: "#1E3A5F" }}>{p.name}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filters.status || ""}
            onChange={(e) => onFilterChange?.({ ...filters, status: e.target.value })}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/50"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <option value="" style={{ backgroundColor: "#1E3A5F" }}>Alle Status</option>
            <option value="open" style={{ backgroundColor: "#1E3A5F" }}>Offen</option>
            <option value="in_progress" style={{ backgroundColor: "#1E3A5F" }}>In Bearbeitung</option>
            <option value="waiting" style={{ backgroundColor: "#1E3A5F" }}>Wartend</option>
            <option value="done" style={{ backgroundColor: "#1E3A5F" }}>Erledigt</option>
          </select>

          {/* Priorität */}
          <select
            value={filters.priority || ""}
            onChange={(e) => onFilterChange?.({ ...filters, priority: e.target.value })}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/50"
            style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          >
            <option value="" style={{ backgroundColor: "#1E3A5F" }}>Alle Prioritäten</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v} style={{ backgroundColor: "#1E3A5F" }}>{l}</option>
            ))}
          </select>

          {/* Suche */}
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <input type="text" placeholder="Suchen..." value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-white/20 py-1.5 pl-9 pr-3 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/50"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          </div>
        </div>

        {/* Rechte Aktionen */}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={onCreateTask}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#2E6DA4" }}>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Neuer Task</span>
          </button>
          <button onClick={() => navigate("/settings")}
            className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Einstellungen">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={handleLogout}
            className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors" title="Abmelden">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tag-Filter-Leiste (unter der Top-Bar, wenn Tags vorhanden) */}
      {tags.length > 0 && (
        <div className="border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-gray-400 shrink-0">Tags:</span>
          {tags.map((tag) => {
            const isActive = activeTagIds.includes(tag.id);
            return (
              <button key={tag.id} onClick={() => toggleTagFilter(tag.id)}
                className="rounded-full px-2.5 py-1 text-xs font-medium border transition-all shrink-0"
                style={isActive
                  ? { backgroundColor: tag.color || "#6b7280", color: "#fff", borderColor: tag.color || "#6b7280" }
                  : { backgroundColor: "transparent", color: tag.color || "#6b7280", borderColor: (tag.color || "#6b7280") + "40" }
                }>
                {tag.name}
              </button>
            );
          })}
          {activeTagIds.length > 0 && (
            <button onClick={() => onFilterChange?.({ ...filters, tag_ids: [] })}
              className="text-xs text-gray-400 hover:text-gray-600 shrink-0 ml-1">
              ✕ Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* Mobile Filter */}
      <div className="md:hidden border-b border-gray-200 bg-white px-4 py-2 flex gap-2">
        <select value={filters.project_id || ""}
          onChange={(e) => onFilterChange?.({ ...filters, project_id: e.target.value })}
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 focus:outline-none">
          <option value="">Alle Projekte</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.priority || ""}
          onChange={(e) => onFilterChange?.({ ...filters, priority: e.target.value })}
          className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-700 focus:outline-none">
          <option value="">Prio</option>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="relative flex-1">
          <svg className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input type="text" placeholder="Suchen..." value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2 text-sm focus:outline-none" />
        </div>
      </div>

      {/* Hauptinhalt */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
