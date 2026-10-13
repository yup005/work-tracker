CREATE TABLE IF NOT EXISTS instruction_acknowledgements (
  email TEXT NOT NULL REFERENCES users(email),
  instruction_id TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (email, instruction_id)
);
