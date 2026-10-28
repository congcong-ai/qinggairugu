CREATE TABLE activity_starters (
  id UUID PRIMARY KEY,
  creator_actor TEXT NOT NULL,
  creator_user_id UUID NOT NULL REFERENCES users(id),
  participant_profile JSONB NOT NULL,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  session_id UUID NOT NULL UNIQUE,
  claimed_user_id UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
