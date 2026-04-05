import { useEffect, useRef } from "react";

// Bestaetigung-Dialog fuer destruktive Aktionen (z.B. Loeschen)
export default function ConfirmDialog({
  isOpen,
  title = "Bestaetigen",
  message,
  confirmLabel = "Bestaetigen",
  cancelLabel = "Abbrechen",
  danger = false,
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);

  // Fokus auf Bestaetigen-Button setzen wenn Dialog oeffnet
  useEffect(() => {
    if (isOpen && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [isOpen]);

  // ESC-Taste zum Schliessen
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    // Halbtransparenter Hintergrund
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
        {message && <p className="mb-6 text-sm text-gray-600">{message}</p>}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-primary-600 hover:bg-primary-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
