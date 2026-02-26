import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoredIntegration {
  name: string;
  url: string;
  description?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastStatus?: "connected" | "error";
  lastToolCount?: number;
  lastConnectedAt?: string;
  lastError?: string;
}

interface Store {
  version: 1;
  integrations: StoredIntegration[];
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

// In Next.js, process.cwd() is the package root (packages/web/) at runtime.
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "integrations.json");

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): Store {
  ensureDir();
  if (!fs.existsSync(STORE_FILE)) {
    return { version: 1, integrations: [] };
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    return JSON.parse(raw) as Store;
  } catch {
    return { version: 1, integrations: [] };
  }
}

function persistStore(store: Store): void {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return all saved integrations ordered by creation date (newest first). */
export function getSavedIntegrations(): StoredIntegration[] {
  return loadStore().integrations.slice().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Upsert an integration record after a connect attempt. */
export function saveIntegration(record: {
  name: string;
  url: string;
  description?: string;
  status: "connected" | "error";
  toolCount: number;
  connectedAt: string;
  error?: string;
}): void {
  const store = loadStore();
  const now = new Date().toISOString();
  const existing = store.integrations.find((i) => i.name === record.name);

  if (existing) {
    existing.url = record.url;
    existing.description = record.description;
    existing.lastStatus = record.status;
    existing.lastToolCount = record.toolCount;
    existing.lastConnectedAt = record.connectedAt;
    existing.lastError = record.error;
    existing.updatedAt = now;
  } else {
    store.integrations.push({
      name: record.name,
      url: record.url,
      description: record.description,
      createdAt: now,
      updatedAt: now,
      lastStatus: record.status,
      lastToolCount: record.toolCount,
      lastConnectedAt: record.connectedAt,
      lastError: record.error,
    });
  }
  persistStore(store);
}

/** Update the notes for a saved integration. Returns false if not found. */
export function updateNotes(name: string, notes: string): boolean {
  const store = loadStore();
  const record = store.integrations.find((i) => i.name === name);
  if (!record) return false;
  record.notes = notes;
  record.updatedAt = new Date().toISOString();
  persistStore(store);
  return true;
}

/** Remove a saved integration. Returns false if not found. */
export function deleteSavedIntegration(name: string): boolean {
  const store = loadStore();
  const before = store.integrations.length;
  store.integrations = store.integrations.filter((i) => i.name !== name);
  if (store.integrations.length === before) return false;
  persistStore(store);
  return true;
}
