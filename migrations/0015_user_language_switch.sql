-- Language switching is an account option controlled by Admin; default off.
ALTER TABLE users ADD COLUMN language_switch_enabled INTEGER NOT NULL DEFAULT 0 CHECK (language_switch_enabled IN (0,1));
