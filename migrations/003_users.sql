CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   TEXT NOT NULL UNIQUE,
  secret     TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('admin','editor','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
