CREATE TABLE installations (id UUID PRIMARY KEY, secret_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE users (id UUID PRIMARY KEY, openid TEXT UNIQUE NOT NULL, profile JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE auth_tokens (hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE sessions (id UUID PRIMARY KEY, organizer_id UUID NOT NULL REFERENCES installations(id), title TEXT NOT NULL, starts_at TIMESTAMPTZ, participant_visibility TEXT NOT NULL CHECK(participant_visibility IN ('everyone','organizer_only')), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE participants (session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, profile JSONB NOT NULL, joined_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(session_id,user_id));
CREATE TABLE recaps (session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE, content TEXT NOT NULL, published_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX participants_user_idx ON participants(user_id);
CREATE INDEX sessions_organizer_idx ON sessions(organizer_id);
CREATE INDEX auth_tokens_user_idx ON auth_tokens(user_id);
