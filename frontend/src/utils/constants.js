// Visuelles Design pro Zeithorizont — Icon und Farben (Tailwind-Klassen)
// Farbverlauf von warm/dringend (heute) bis kuehl/entspannt (someday)
export const HORIZON_CONFIG = {
  inbox:          { icon: "📥", headerBg: "bg-slate-100",   headerText: "text-slate-700",   countBg: "bg-slate-200",   countText: "text-slate-600" },
  today:          { icon: "🔴", headerBg: "bg-red-50",      headerText: "text-red-800",     countBg: "bg-red-100",     countText: "text-red-600" },
  tomorrow:       { icon: "🟠", headerBg: "bg-orange-50",   headerText: "text-orange-800",  countBg: "bg-orange-100",  countText: "text-orange-600" },
  this_week:      { icon: "🟡", headerBg: "bg-amber-50",    headerText: "text-amber-800",   countBg: "bg-amber-100",   countText: "text-amber-600" },
  next_week:      { icon: "🟢", headerBg: "bg-emerald-50",  headerText: "text-emerald-800", countBg: "bg-emerald-100", countText: "text-emerald-600" },
  this_month:     { icon: "📅", headerBg: "bg-teal-50",     headerText: "text-teal-800",    countBg: "bg-teal-100",    countText: "text-teal-600" },
  next_month:     { icon: "📆", headerBg: "bg-cyan-50",     headerText: "text-cyan-800",    countBg: "bg-cyan-100",    countText: "text-cyan-600" },
  this_quarter:   { icon: "🗓️", headerBg: "bg-sky-50",      headerText: "text-sky-800",     countBg: "bg-sky-100",     countText: "text-sky-600" },
  next_quarter:   { icon: "📊", headerBg: "bg-blue-50",     headerText: "text-blue-800",    countBg: "bg-blue-100",    countText: "text-blue-600" },
  this_year:      { icon: "🎯", headerBg: "bg-indigo-50",   headerText: "text-indigo-800",  countBg: "bg-indigo-100",  countText: "text-indigo-600" },
  next_year:      { icon: "🔮", headerBg: "bg-violet-50",   headerText: "text-violet-800",  countBg: "bg-violet-100",  countText: "text-violet-600" },
  someday_maybe:  { icon: "💭", headerBg: "bg-gray-50",     headerText: "text-gray-600",    countBg: "bg-gray-100",    countText: "text-gray-500" },
};

// Bezeichnungen fuer die Zeithorizonte (Kanban-Spalten)
export const HORIZON_LABELS = {
  inbox: "Inbox",
  today: "Heute",
  tomorrow: "Morgen",
  this_week: "Diese Woche",
  next_week: "Nächste Woche",
  this_month: "Diesen Monat",
  next_month: "Nächsten Monat",
  this_quarter: "Dieses Quartal",
  next_quarter: "Nächstes Quartal",
  this_year: "Dieses Jahr",
  next_year: "Nächstes Jahr",
  someday_maybe: "Someday/Maybe",
};

// Sichtbare Horizonte im Kanban-Board
export const VISIBLE_HORIZONS = ["inbox", "today", "tomorrow", "this_week", "next_week", "this_quarter", "this_year", "someday_maybe"];

// Horizonte für Dropdowns (nur die sichtbaren)
export const HORIZON_DROPDOWN = VISIBLE_HORIZONS;

// Vollständige Reihenfolge aller Horizonte (inkl. der in DB existierenden aber nicht sichtbaren)
export const HORIZON_ORDER = [
  "inbox", "today", "tomorrow", "this_week", "next_week",
  "this_month", "next_month", "this_quarter", "next_quarter",
  "this_year", "next_year", "someday_maybe",
];

// Bezeichnungen fuer Task-Status
export const STATUS_LABELS = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  waiting: "Wartend",
  done: "Erledigt",
  cancelled: "Abgebrochen",
};

// Farben fuer Task-Status (Tailwind-Klassen)
export const STATUS_COLORS = {
  open: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  waiting: "bg-amber-100 text-amber-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

// Bezeichnungen fuer Priorität
export const PRIORITY_LABELS = {
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
};

// Sortier-Gewicht: hoch zuerst, keine Priorität zuletzt
export const PRIORITY_SORT_ORDER = { high: 0, medium: 1, low: 2 };

// Farben fuer Priorität (Tailwind-Klassen)
export const PRIORITY_COLORS = {
  high: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-300" },
  low: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
};

// Bezeichnungen fuer Zeitaufwand-Tags
export const DURATION_LABELS = {
  "5min": "5 Min",
  "15min": "15 Min",
  "30min": "30 Min",
  "1h": "1 Std",
  "2h": "2 Std",
  "4h": "4 Std",
  "1d": "1 Tag",
};

// Optionen fuer Dropdown/Pill-Selector
export const DURATION_OPTIONS = Object.entries(DURATION_LABELS).map(
  ([value, label]) => ({ value, label })
);

// Standard-Projektfarben zur Auswahl
export const PROJECT_COLORS = [
  "#3b82f6", // blau
  "#10b981", // gruen
  "#f59e0b", // gelb
  "#ef4444", // rot
  "#8b5cf6", // violett
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
];
