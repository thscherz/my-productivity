import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import KanbanPage from "./pages/KanbanPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import SettingsPage from "./pages/SettingsPage";
import LoadingSpinner from "./components/common/LoadingSpinner";
import { api } from "./api/client";

// Root-Komponente: Auth-State verwalten und Routing
export default function App() {
  // null = noch nicht geprueft, true = eingeloggt, false = nicht eingeloggt
  const [authenticated, setAuthenticated] = useState(null);

  // Auth-Status beim Start pruefen
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.get("/auth/check");
        setAuthenticated(true);
      } catch {
        // 401 = nicht eingeloggt
        setAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Waehrend Auth-Pruefung einen Spinner zeigen
  if (authenticated === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Nicht eingeloggt — Login-Seite anzeigen
  if (!authenticated) {
    return <LoginPage onLoginSuccess={() => setAuthenticated(true)} />;
  }

  // Eingeloggt — App mit Routing
  return (
    <BrowserRouter>
      <Routes>
        {/* Haupt-Kanban-Board */}
        <Route
          path="/"
          element={<KanbanPage onLogout={() => setAuthenticated(false)} />}
        />

        {/* Task-Detail-Seite */}
        <Route
          path="/task/:id"
          element={<TaskDetailPage />}
        />

        {/* Einstellungen */}
        <Route
          path="/settings"
          element={<SettingsPage onLogout={() => setAuthenticated(false)} />}
        />

        {/* Fallback: zurueck zur Startseite */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
