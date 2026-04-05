# =============================================================================
# Stage 1: Frontend bauen
# =============================================================================
FROM node:20-slim AS build-frontend

WORKDIR /app/frontend

# Zuerst nur package.json kopieren (besseres Layer-Caching)
COPY frontend/package.json frontend/package-lock.json ./

RUN npm ci

# Quellcode kopieren und bauen
COPY frontend/ ./

RUN npm run build

# =============================================================================
# Stage 2: Python App
# =============================================================================
FROM python:3.11-slim AS app

# System-Dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Zuerst nur requirements.txt (besseres Layer-Caching)
COPY backend/requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

# Backend-Code kopieren
COPY backend/ ./

# Frontend-Build aus Stage 1 kopieren
COPY --from=build-frontend /app/frontend/dist /app/frontend/dist

# Datenverzeichnis erstellen (SQLite-Persistenz via Volume)
RUN mkdir -p /app/backend/data

# Volume fuer SQLite-Datenbank
VOLUME ["/app/backend/data"]

# Port freigeben
EXPOSE 8001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/api/v1/health')"

# App starten
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
