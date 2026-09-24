-- How many reminders of each kind a participant has received: the phrase tone escalates with it.
-- Written only by the hourly cron, like the reminders table.
CREATE TABLE reminder_counts (
  code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (code, user_id, kind)
);
