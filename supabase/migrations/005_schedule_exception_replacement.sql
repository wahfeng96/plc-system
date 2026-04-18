-- Add replacement columns to schedule_exceptions for "move class" feature
alter table schedule_exceptions add column if not exists replacement_date date;
alter table schedule_exceptions add column if not exists replacement_start_time time;
alter table schedule_exceptions add column if not exists replacement_end_time time;
alter table schedule_exceptions add column if not exists replacement_room_id uuid references rooms on delete set null;
