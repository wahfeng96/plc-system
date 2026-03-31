# Perseverance Learning Centre — Management System

## Business Overview
Tuition centre in Tawau, Sabah that RENTS classrooms to independent teachers.
- 8 classrooms (Room 1-8)
- ~8 teachers (independent tenants, NOT employees)
- 400-500 students
- Secondary level: Form 1 to A-level
- Subjects: Mathematics, Economics, Business Studies, BM, English, Science, Prinsip Akaun
- Exam systems: UEC, SPM, IGCSE
- ~30-35 classes per week
- Each class = 2 hours
- Class types: 1-to-1, Small group (<10), Large group (10-40)

## Revenue Model
1. **Room rental**: RM22/hour × 2hr = RM44/class. All rooms same rate. Billed monthly to teacher.
2. **Registration fee**: 1st subject = RM100/year, 2nd subject onwards = RM50/year each. Paid by student.
3. **Commission**: 10% of monthly tuition fee for students registered BY ADMIN (not by teacher). Charged to teacher monthly. Lasts 1 academic year (Jan-Nov, 10-11 months). Stops when student drops or year ends.

## User Roles
1. **Admin** — full access: manage everything, generate invoices
2. **Teacher** — mark attendance, view/set their own schedule, view their students & rental summary
3. **Guard** — view today's room schedule only (which rooms to open)
4. **Parent/Student** — view public timetable + holiday announcements (no login needed)

## Tech Stack
- Next.js 14+ (App Router)
- Supabase (Auth + Database + RLS)
- TypeScript
- Tailwind CSS + shadcn/ui components
- Mobile-first responsive design
- Deploy on Render

## Database Schema

### teachers
- id (uuid, PK)
- user_id (uuid, FK → auth.users, nullable)
- name (text)
- phone (text)
- email (text)
- subjects (text[]) — e.g. ["Mathematics", "Science"]
- status (text: active/inactive)
- created_at (timestamptz)

### students
- id (uuid, PK)
- name (text)
- phone (text, nullable)
- parent_name (text)
- parent_phone (text)
- form_level (text) — e.g. "Form 1", "Form 4", "A-Level"
- registered_by (text: "admin" | "teacher")
- registration_date (date)
- status (text: active/inactive)
- created_at (timestamptz)

### student_subjects
- id (uuid, PK)
- student_id (uuid, FK → students)
- teacher_id (uuid, FK → teachers)
- subject (text) — e.g. "Mathematics"
- exam_system (text) — e.g. "SPM", "UEC", "IGCSE"
- tuition_fee (numeric) — monthly fee, e.g. 150
- academic_year (int) — e.g. 2026
- registered_by_admin (boolean) — true = admin registered, commission applies
- commission_start (date) — when commission tracking starts
- commission_end (date, nullable) — when student dropped or year ended
- status (text: active/dropped)
- created_at (timestamptz)

### rooms
- id (uuid, PK)
- name (text) — "Room 1" to "Room 8"
- hourly_rate (numeric) — 22
- status (text: active/inactive)

### schedules
- id (uuid, PK)
- teacher_id (uuid, FK → teachers)
- room_id (uuid, FK → rooms)
- subject (text)
- exam_system (text)
- day_of_week (int) — 0=Sun, 1=Mon, ..., 6=Sat
- start_time (time) — e.g. "14:00"
- end_time (time) — e.g. "16:00"
- class_type (text: "1-to-1" | "small_group" | "large_group")
- effective_from (date)
- effective_until (date, nullable)
- status (text: active/paused/cancelled)
- created_at (timestamptz)

### schedule_exceptions
- id (uuid, PK)
- schedule_id (uuid, FK → schedules, nullable)
- date (date)
- type (text: "holiday" | "cancelled" | "replacement" | "exam_break")
- title (text) — e.g. "Chinese New Year", "Mid-term Exam"
- affects (text: "all" | "specific") — all teachers or specific schedule
- notes (text, nullable)
- created_at (timestamptz)

### class_sessions
- id (uuid, PK)
- schedule_id (uuid, FK → schedules)
- date (date)
- room_id (uuid, FK → rooms)
- teacher_id (uuid, FK → teachers)
- status (text: "scheduled" | "completed" | "cancelled")
- hours (numeric) — 2
- rental_amount (numeric) — 44
- created_at (timestamptz)

### attendance
- id (uuid, PK)
- class_session_id (uuid, FK → class_sessions)
- student_id (uuid, FK → students)
- status (text: "present" | "absent" | "late")
- marked_by (uuid, FK → auth.users)
- marked_at (timestamptz)

### invoices
- id (uuid, PK)
- teacher_id (uuid, FK → teachers)
- month (text) — "2026-03"
- room_rental_total (numeric)
- commission_total (numeric)
- grand_total (numeric)
- status (text: "draft" | "issued" | "paid")
- issued_at (timestamptz, nullable)
- paid_at (timestamptz, nullable)
- created_at (timestamptz)

### invoice_items
- id (uuid, PK)
- invoice_id (uuid, FK → invoices)
- type (text: "rental" | "commission")
- description (text)
- amount (numeric)
- class_session_id (uuid, FK → class_sessions, nullable)
- student_subject_id (uuid, FK → student_subjects, nullable)

## Pages

### Admin Pages
1. **Dashboard** — overview: total students, teachers, classes this week, revenue summary
2. **Timetable** — weekly grid view (rooms × time slots), color-coded by teacher. Can mark holidays/exceptions.
3. **Teachers** — CRUD teachers, view each teacher's schedule, students, rental summary
4. **Students** — register new students, assign subjects/teachers, auto-calc registration fee, track registered_by
5. **Rooms** — list rooms, set hourly rate
6. **Attendance** — view/export attendance by teacher, class, or student. Monthly summary.
7. **Invoices** — generate monthly invoice per teacher (room rental + commission). Export/print.
8. **Holidays** — manage school holidays, exam periods. Affects all schedules.

### Teacher Pages
1. **My Schedule** — see their weekly timetable
2. **Take Attendance** — select today's class → see student list → tap present/absent
3. **My Students** — list of students in their classes
4. **My Rental** — monthly summary of room usage and amount owed

### Guard Page
1. **Today's Schedule** — simple list: Room X → Time → Teacher → Subject. Just what rooms to open.

### Public Page (no login)
1. **Timetable** — public weekly schedule
2. **Announcements** — holidays, exam breaks

## Key Features
- **Auto-generate class sessions**: From weekly schedule, auto-create sessions for each week (skip holidays)
- **Attendance on phone**: Teacher opens app → sees today's classes → taps student names → done
- **Monthly invoice auto-calc**: Sum up room rental (sessions × RM44) + commission (10% × tuition × admin-registered students)
- **Registration fee auto-calc**: RM100 first subject + RM50 per additional
- **Room conflict detection**: Warn if two teachers book same room same time
- **Mobile-first**: Teachers use phones for attendance

## Design
- Clean, modern, mobile-first
- Primary color: Blue (#2563eb) — professional education vibe
- shadcn/ui components
- Bottom navigation for mobile (Dashboard, Schedule, Attendance, More)

## Important Notes
- This is an INTERNAL management system, not a student-facing LMS
- Teachers are TENANTS, not employees. They collect their own tuition fees.
- Admin only collects: room rental + registration fee + commission
- Keep it simple. Don't over-engineer.
