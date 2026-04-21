-- Comments storage.
--
-- One row per submission. `status` is:
--   'pending'   — awaiting moderation (Haiku + human review)
--   'approved'  — visible on the public GET endpoint
--   'rejected'  — hidden; kept for audit
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_slug TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_email TEXT,
    body TEXT NOT NULL,
    body_html TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    moderated_at TEXT,
    moderation_reason TEXT,
    client_ip_hash TEXT NOT NULL,
    user_agent TEXT,
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_comments_slug_status_created
    ON comments (post_slug, status, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_status_created
    ON comments (status, created_at);

-- Per-IP submission rate tracking. Populated opportunistically by the POST
-- endpoint in Phase 6. Kept separate so heavy spammers don't bloat the main
-- comments table.
CREATE TABLE IF NOT EXISTS submission_log (
    client_ip_hash TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_submission_log_hash_time
    ON submission_log (client_ip_hash, submitted_at);
