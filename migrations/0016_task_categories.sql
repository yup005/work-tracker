CREATE TABLE IF NOT EXISTS task_categories (
  name TEXT PRIMARY KEY COLLATE NOCASE CHECK(length(name) BETWEEN 1 AND 80)
);
INSERT OR IGNORE INTO task_categories(name) VALUES
  ('General'),('Billing'),('Reports'),('Scheduling'),('Patients'),('Other');
INSERT OR IGNORE INTO task_categories(name)
SELECT DISTINCT trim(category) FROM tasks
WHERE category IS NOT NULL AND length(trim(category)) BETWEEN 1 AND 80;
