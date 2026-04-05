// Leer-Zustand fuer Kanban-Spalten und Listen
export default function EmptyState({ message = "Keine Eintraege", icon = null, compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-gray-400">
        <p className="text-sm">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {icon ? (
        <div className="mb-3 text-gray-300">{icon}</div>
      ) : (
        // Standard-Icon: leere Inbox
        <svg
          className="mb-3 h-10 w-10 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      )}
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
