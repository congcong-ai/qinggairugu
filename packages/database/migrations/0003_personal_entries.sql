CREATE TABLE personal_entries (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), session_id UUID REFERENCES sessions(id),
 title TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL, location TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', people JSONB NOT NULL DEFAULT '[]', version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX personal_entries_user_time_idx ON personal_entries(user_id, occurred_at DESC, id);
CREATE INDEX personal_entries_session_idx ON personal_entries(session_id);
