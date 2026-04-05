import { useState, useRef } from "react";
import { attachmentsApi } from "../../api/attachments";

// Maximale Upload-Grösse in Bytes (10 MB)
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// Dateigrösse lesbar formatieren
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Icon je nach MIME-Type
function fileIcon(contentType) {
  if (!contentType) return "📎";
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType.includes("pdf")) return "📄";
  if (contentType.includes("spreadsheet") || contentType.includes("excel") || contentType.includes("xlsx")) return "📊";
  if (contentType.startsWith("text/")) return "📝";
  return "📎";
}

// Anhänge-Bereich fuer die Task-Detailseite
// Props: taskId, attachments (initiale Liste vom Server), onUpdate (Callback nach Upload/Delete)
export default function AttachmentSection({ taskId, attachments = [], onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  // Datei hochladen
  const handleUpload = async (file) => {
    if (!file) return;

    // Grössen-Check
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`Datei zu gross (max. 10 MB). Diese Datei hat ${formatFileSize(file.size)}.`);
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      await attachmentsApi.upload(taskId, file);
      onUpdate?.();
    } catch (err) {
      setUploadError(err.message || "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
      // File-Input zurücksetzen, damit dieselbe Datei erneut hochgeladen werden kann
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // File-Input Change-Handler
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  // Drag & Drop Handler
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    // Nur auslösen wenn der Pointer wirklich die Zone verlässt (nicht bei Kindelementen)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  // Anhang löschen
  const handleDelete = async (attachmentId) => {
    setDeletingId(attachmentId);
    try {
      await attachmentsApi.delete(taskId, attachmentId);
      onUpdate?.();
    } catch {
      // Fehler ignorieren — UI aktualisiert sich beim nächsten Laden
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
      {/* Abschnitts-Header */}
      <h3 className="font-semibold text-gray-900 mb-3">
        Anhänge
        {attachments.length > 0 && (
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({attachments.length})
          </span>
        )}
      </h3>

      {/* Anhang-Liste */}
      {attachments.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              {/* Datei-Icon */}
              <span className="text-lg shrink-0" aria-hidden="true">
                {fileIcon(att.content_type)}
              </span>

              {/* Dateiname + Grösse */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate" title={att.filename}>
                  {att.filename}
                </p>
                {att.file_size != null && (
                  <p className="text-xs text-gray-400">{formatFileSize(att.file_size)}</p>
                )}
              </div>

              {/* Download-Button */}
              <button
                type="button"
                onClick={() => attachmentsApi.download(taskId, att.id)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-primary-50 hover:text-primary-700 transition-colors shrink-0"
                title="Herunterladen"
                aria-label={`${att.filename} herunterladen`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* Löschen-Button */}
              <button
                type="button"
                onClick={() => handleDelete(att.id)}
                disabled={deletingId === att.id}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 disabled:opacity-40"
                title="Löschen"
                aria-label={`${att.filename} löschen`}
              >
                {deletingId === att.id ? (
                  // Spinner waehrend Löschen
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Fehler-Hinweis */}
      {uploadError && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {uploadError}
        </div>
      )}

      {/* Drag & Drop Upload-Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
          isDragOver
            ? "border-primary-400 bg-primary-50"
            : "border-gray-200 bg-gray-50 hover:border-gray-300"
        }`}
      >
        {uploading ? (
          // Spinner waehrend Upload
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="h-5 w-5 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Hochladen…
          </div>
        ) : (
          <>
            <svg
              className={`h-8 w-8 transition-colors ${isDragOver ? "text-primary-500" : "text-gray-300"}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <p className="text-sm text-gray-500">
              Datei hierhin ziehen oder{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
              >
                Datei auswählen
              </button>
            </p>
            <p className="text-xs text-gray-400">Maximal 10 MB</p>
          </>
        )}
      </div>

      {/* Versteckter File-Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
        aria-label="Datei hochladen"
      />
    </div>
  );
}
