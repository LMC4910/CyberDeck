-- 0001_init — the durable tables (TRD 2B §6 / ADR-0014).
-- Only durable data lives here; live state and series ring buffers are in-memory
-- (TB-ST-3). *_json columns hold typed structures owned by their subsystems and
-- are validated at the repo layer. Secrets are NEVER stored here (TB-PER-3).

-- documents: profiles, pages, widgets serialized as the layout doc tree (2C owns shape).
CREATE TABLE documents (
    id           TEXT PRIMARY KEY,
    kind         TEXT,            -- 'profile' | 'page'
    device_class TEXT,
    version      INTEGER,         -- monotonic doc version (2C / ADR-0012)
    body_json    TEXT,
    updated_at   INTEGER
);

-- registry_items: merged registry contributions (action / widget / flow-node).
CREATE TABLE registry_items (
    id          TEXT PRIMARY KEY,
    kind        TEXT,             -- 'action' | 'widget' | 'flownode'
    source      TEXT,
    schema_json TEXT,
    version     INTEGER
);

-- variables: var.* — typed, durable.
CREATE TABLE variables (
    name       TEXT PRIMARY KEY,
    value_type TEXT,
    value_json TEXT,
    updated_at INTEGER
);

-- workflows: flows (2D owns shape).
CREATE TABLE workflows (
    id         TEXT PRIMARY KEY,
    label      TEXT,
    version    INTEGER,
    body_json  TEXT,
    updated_at INTEGER
);

-- devices: trust + permissions (2E §2.3 owns semantics). public_key is the
-- identity anchor; private keys are NEVER stored here (they live in the OS
-- secret store, PROJ-121).
CREATE TABLE devices (
    uuid               TEXT PRIMARY KEY,
    label              TEXT,
    public_key         BLOB,
    device_class       TEXT,
    permissions_json   TEXT,
    locator_hints_json TEXT,
    revoked            INTEGER,
    paired_at          INTEGER,
    last_seen          INTEGER
);

-- accounts: reserved for the Phase-7 cloud overlay; references device UUIDs,
-- never owns identity (ADR-0016). Structurally present but unused in V1.
CREATE TABLE accounts (
    id         TEXT PRIMARY KEY,
    email      TEXT,
    tier       TEXT,
    created_at INTEGER
);

-- audit_log: append-only (2E §6 owns semantics; enforced at the repo layer).
CREATE TABLE audit_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            INTEGER,
    actor         TEXT,
    event_type    TEXT,
    resource_type TEXT,
    resource_id   TEXT,
    payload_json  TEXT
);

-- meta: schema/config versioning for migrations. The runner bootstraps this
-- table too, so create it only if absent.
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Indexes for the expected queries (audit search by actor/type; documents by class).
CREATE INDEX idx_audit_actor ON audit_log (actor);
CREATE INDEX idx_audit_event_type ON audit_log (event_type);
CREATE INDEX idx_documents_device_class ON documents (device_class);
