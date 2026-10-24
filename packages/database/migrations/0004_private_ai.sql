CREATE TABLE private_ai_results (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id), binding_id UUID NOT NULL REFERENCES app_bindings(id),
 local_session_id UUID NOT NULL, session_id UUID REFERENCES sessions(id), title TEXT NOT NULL,
 source_version TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, fields JSONB NOT NULL, content JSONB NOT NULL,
 deleted_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(binding_id,local_session_id)
);
CREATE INDEX private_ai_results_user_idx ON private_ai_results(user_id);
