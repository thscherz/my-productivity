import { useState } from "react";
import { api } from "../api/client";

// Login-Seite mit Passwort-Eingabe
export default function LoginPage({ onLoginSuccess }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError("Bitte Passwort eingeben.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/login", { password });
      onLoginSuccess();
    } catch (err) {
      setError(err.detail || "Falsches Passwort. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #d9e2ec 0%, #F5F4F2 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* App-Logo und Titel */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
            style={{ backgroundColor: "#1E3A5F" }}
          >
            <svg className="h-9 w-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>myProductivity</h1>
          <p className="mt-1 text-sm" style={{ color: "#6B6B6B" }}>Persönliches Task-Management</p>
        </div>

        {/* Login-Karte */}
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Fehlermeldung */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            {/* Passwort-Feld */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoFocus
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": "#2E6DA4" }}
                onFocus={(e) => { e.target.style.borderColor = "#2E6DA4"; }}
                onBlur={(e) => { e.target.style.borderColor = ""; }}
              />
            </div>

            {/* Login-Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1E3A5F" }}
            >
              {loading ? "Anmelden..." : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
