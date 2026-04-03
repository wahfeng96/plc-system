export type UserRole = 'admin' | 'teacher' | 'guard' | 'pending'

export interface Profile {
  id: string
  role: UserRole
  created_at: string
}

export interface Teacher {
  id: string
  user_id: string | null
  name: string
  phone: string
  email: string
  subjects: string[]
  status: 'active' | 'inactive'
  created_at: string
}

export interface Student {
  id: string
  name: string
  phone: string | null
  parent_name: string
  parent_phone: string
  form_level: string
  registered_by: 'admin' | 'teacher'
  registration_date: string
  status: 'active' | 'inactive'
  created_at: string
}

export interface StudentSubject {
  id: string
  student_id: string
  teacher_id: string
  subject: string
  exam_system: string
  tuition_fee: number
  academic_year: number
  registered_by_admin: boolean
  commission_start: string
  commission_end: string | null
  status: 'active' | 'dropped'
  created_at: string
  teacher?: Teacher
  student?: Student
}

export interface Room {
  id: string
  name: string
  hourly_rate: number
  status: 'active' | 'inactive'
}

export interface Schedule {
  id: string
  teacher_id: string
  room_id: string
  subject: string
  exam_system: string
  day_of_week: number
  start_time: string
  end_time: string
  class_type: '1-to-1' | 'small_group' | 'large_group'
  effective_from: string
  effective_until: string | null
  status: 'active' | 'paused' | 'cancelled'
  created_at: string
  teacher?: Teacher
  room?: Room
}

export interface ClassType {
  id: string
  name: string
  subject: string
  exam_system: string
  form_level: string
  status: string
  created_at: string
}

export interface ScheduleException {
  id: string
  schedule_id: string | null
  date: string
  type: 'holiday' | 'cancelled' | 'replacement' | 'exam_break'
  title: string
  affects: 'all' | 'specific'
  notes: string | null
  replacement_date: string | null
  replacement_start_time: string | null
  replacement_end_time: string | null
  replacement_room_id: string | null
  created_at: string
}

export interface ClassSession {
  id: string
  schedule_id: string
  date: string
  room_id: string
  teacher_id: string
  status: 'scheduled' | 'completed' | 'cancelled'
  hours: number
  rental_amount: number
  created_at: string
  schedule?: Schedule
  room?: Room
  teacher?: Teacher
}

export interface Attendance {
  id: string
  class_session_id: string
  student_id: string
  status: 'present' | 'absent' | 'late'
  marked_by: string
  marked_at: string
  student?: Student
}

export interface Invoice {
  id: string
  teacher_id: string
  month: string
  room_rental_total: number
  commission_total: number
  grand_total: number
  status: 'draft' | 'issued' | 'paid'
  issued_at: string | null
  paid_at: string | null
  created_at: string
  teacher?: Teacher
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  type: 'rental' | 'commission'
  description: string
  amount: number
  class_session_id: string | null
  student_subject_id: string | null
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const SUBJECTS = [
  'Mathematics', 'Economics', 'Business Studies', 'Bahasa Melayu',
  'English', 'Science', 'Prinsip Akaun', 'Physics', 'Chemistry', 'Biology',
  'Additional Mathematics', 'Accounting'
]

export const EXAM_SYSTEMS = ['SPM', 'UEC', 'IGCSE', 'A-Level']

export const FORM_LEVELS = [
  'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Form 6', 'A-Level'
]

export const CLASS_TYPES = [
  { value: '1-to-1', label: '1-to-1' },
  { value: 'small_group', label: 'Small Group (<10)' },
  { value: 'large_group', label: 'Large Group (10-40)' },
]

export const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
]
