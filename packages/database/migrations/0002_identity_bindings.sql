ALTER TABLE sessions ALTER COLUMN organizer_id DROP NOT NULL;
ALTER TABLE sessions ADD COLUMN organizer_user_id UUID REFERENCES users(id);
ALTER TABLE sessions ADD CONSTRAINT sessions_single_owner CHECK ((organizer_id IS NULL) <> (organizer_user_id IS NULL));
ALTER TABLE sessions ADD COLUMN location TEXT;
ALTER TABLE sessions ADD COLUMN category TEXT;
CREATE INDEX sessions_user_owner_idx ON sessions(organizer_user_id);
CREATE TABLE app_bindings (
 id UUID PRIMARY KEY, installation_id UUID NOT NULL REFERENCES installations(id), user_id UUID NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX app_bindings_active_device ON app_bindings(installation_id) WHERE revoked_at IS NULL;
CREATE INDEX app_bindings_user_idx ON app_bindings(user_id);
CREATE TABLE binding_challenges (
 id UUID PRIMARY KEY, installation_id UUID NOT NULL REFERENCES installations(id), token_hash TEXT UNIQUE NOT NULL, code_hash TEXT UNIQUE NOT NULL,
 claimed_user_id UUID REFERENCES users(id), expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE binding_attempts (actor_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, window_at TIMESTAMPTZ NOT NULL DEFAULT now());
