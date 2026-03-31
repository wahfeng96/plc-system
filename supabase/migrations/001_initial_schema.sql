-- Profiles table for role management
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'guard')) default 'teacher',
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile" on profiles
  for select using (auth.uid() = id);

create policy "Admins can read all profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Teachers
create table teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users unique,
  name text not null,
  phone text not null default '',
  email text not null default '',
  subjects text[] not null default '{}',
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz default now()
);

alter table teachers enable row level security;

create policy "Anyone authenticated can read teachers" on teachers
  for select using (auth.uid() is not null);

create policy "Admins can manage teachers" on teachers
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Students
create table students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  parent_name text not null default '',
  parent_phone text not null default '',
  form_level text not null default '',
  registered_by text not null check (registered_by in ('admin', 'teacher')) default 'admin',
  registration_date date not null default current_date,
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz default now()
);

alter table students enable row level security;

create policy "Anyone authenticated can read students" on students
  for select using (auth.uid() is not null);

create policy "Admins can manage students" on students
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Student subjects
create table student_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  teacher_id uuid not null references teachers on delete cascade,
  subject text not null,
  exam_system text not null default 'SPM',
  tuition_fee numeric not null default 0,
  academic_year int not null default extract(year from current_date),
  registered_by_admin boolean not null default true,
  commission_start date not null default current_date,
  commission_end date,
  status text not null check (status in ('active', 'dropped')) default 'active',
  created_at timestamptz default now()
);

alter table student_subjects enable row level security;

create policy "Anyone authenticated can read student_subjects" on student_subjects
  for select using (auth.uid() is not null);

create policy "Admins can manage student_subjects" on student_subjects
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Rooms
create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hourly_rate numeric not null default 22,
  status text not null check (status in ('active', 'inactive')) default 'active'
);

alter table rooms enable row level security;

create policy "Anyone can read rooms" on rooms
  for select using (true);

create policy "Admins can manage rooms" on rooms
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Schedules
create table schedules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers on delete cascade,
  room_id uuid not null references rooms on delete cascade,
  subject text not null,
  exam_system text not null default 'SPM',
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  class_type text not null check (class_type in ('1-to-1', 'small_group', 'large_group')) default 'large_group',
  effective_from date not null default current_date,
  effective_until date,
  status text not null check (status in ('active', 'paused', 'cancelled')) default 'active',
  created_at timestamptz default now()
);

alter table schedules enable row level security;

create policy "Anyone can read schedules" on schedules
  for select using (true);

create policy "Admins can manage schedules" on schedules
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Schedule exceptions (holidays, cancellations, etc.)
create table schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references schedules on delete cascade,
  date date not null,
  type text not null check (type in ('holiday', 'cancelled', 'replacement', 'exam_break')),
  title text not null,
  affects text not null check (affects in ('all', 'specific')) default 'all',
  notes text,
  created_at timestamptz default now()
);

alter table schedule_exceptions enable row level security;

create policy "Anyone can read schedule_exceptions" on schedule_exceptions
  for select using (true);

create policy "Admins can manage schedule_exceptions" on schedule_exceptions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Class sessions (generated from schedules)
create table class_sessions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references schedules on delete cascade,
  date date not null,
  room_id uuid not null references rooms on delete cascade,
  teacher_id uuid not null references teachers on delete cascade,
  status text not null check (status in ('scheduled', 'completed', 'cancelled')) default 'scheduled',
  hours numeric not null default 2,
  rental_amount numeric not null default 44,
  created_at timestamptz default now()
);

alter table class_sessions enable row level security;

create policy "Anyone authenticated can read class_sessions" on class_sessions
  for select using (auth.uid() is not null);

create policy "Admins can manage class_sessions" on class_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Teachers can update own class_sessions" on class_sessions
  for update using (
    exists (
      select 1 from teachers
      where teachers.id = class_sessions.teacher_id
      and teachers.user_id = auth.uid()
    )
  );

-- Attendance
create table attendance (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references class_sessions on delete cascade,
  student_id uuid not null references students on delete cascade,
  status text not null check (status in ('present', 'absent', 'late')) default 'absent',
  marked_by uuid references auth.users,
  marked_at timestamptz default now(),
  unique (class_session_id, student_id)
);

alter table attendance enable row level security;

create policy "Anyone authenticated can read attendance" on attendance
  for select using (auth.uid() is not null);

create policy "Admins can manage attendance" on attendance
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Teachers can manage attendance for own sessions" on attendance
  for all using (
    exists (
      select 1 from class_sessions cs
      join teachers t on t.id = cs.teacher_id
      where cs.id = attendance.class_session_id
      and t.user_id = auth.uid()
    )
  );

-- Invoices
create table invoices (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers on delete cascade,
  month text not null,
  room_rental_total numeric not null default 0,
  commission_total numeric not null default 0,
  grand_total numeric not null default 0,
  status text not null check (status in ('draft', 'issued', 'paid')) default 'draft',
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now(),
  unique (teacher_id, month)
);

alter table invoices enable row level security;

create policy "Admins can manage invoices" on invoices
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Teachers can read own invoices" on invoices
  for select using (
    exists (
      select 1 from teachers
      where teachers.id = invoices.teacher_id
      and teachers.user_id = auth.uid()
    )
  );

-- Invoice items
create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices on delete cascade,
  type text not null check (type in ('rental', 'commission')),
  description text not null,
  amount numeric not null default 0,
  class_session_id uuid references class_sessions,
  student_subject_id uuid references student_subjects
);

alter table invoice_items enable row level security;

create policy "Admins can manage invoice_items" on invoice_items
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Teachers can read own invoice_items" on invoice_items
  for select using (
    exists (
      select 1 from invoices i
      join teachers t on t.id = i.teacher_id
      where i.id = invoice_items.invoice_id
      and t.user_id = auth.uid()
    )
  );

-- Seed default rooms
insert into rooms (name, hourly_rate) values
  ('Room 1', 22), ('Room 2', 22), ('Room 3', 22), ('Room 4', 22),
  ('Room 5', 22), ('Room 6', 22), ('Room 7', 22), ('Room 8', 22);

-- Function to handle new user profile creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'role', 'teacher'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
