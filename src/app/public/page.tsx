import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { DAYS } from '@/lib/types'
import type { Schedule, Teacher, Room, ScheduleException } from '@/lib/types'
import Link from 'next/link'

export default async function PublicPage() {
  const supabase = await createClient()

  const [schedulesRes, , , exceptionsRes] = await Promise.all([
    supabase.from('schedules').select('*, teacher:teachers(*), room:rooms(*)').eq('status', 'active'),
    supabase.from('rooms').select('*').eq('status', 'active').order('name'),
    supabase.from('teachers').select('*').eq('status', 'active').order('name'),
    supabase.from('schedule_exceptions').select('*').eq('affects', 'all').order('date', { ascending: false }).limit(10),
  ])

  const schedules = (schedulesRes.data || []) as (Schedule & { teacher?: Teacher; room?: Room })[]
  const exceptions = (exceptionsRes.data || []) as ScheduleException[]

  const TEACHER_COLORS = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-red-100 text-red-800 border-red-200',
  ]

  const teacherColors = new Map<string, string>()
  const uniqueTeachers = Array.from(new Map(schedules.map(s => [s.teacher_id, s.teacher])).values()).filter(Boolean)
  uniqueTeachers.forEach((t, i) => t && teacherColors.set(t.id, TEACHER_COLORS[i % TEACHER_COLORS.length]))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">Perseverance Learning Centre</h1>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">Staff Login</Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Announcements */}
        {exceptions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-3">Announcements</h2>
            <div className="space-y-2">
              {exceptions.map(ex => (
                <div key={ex.id} className="bg-white rounded-lg p-3 border border-yellow-200 bg-yellow-50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ex.title}</span>
                    <span className="text-sm text-gray-500">{ex.date}</span>
                  </div>
                  {ex.notes && <p className="text-sm text-gray-600 mt-1">{ex.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Timetable */}
        <h2 className="text-lg font-bold mb-3">Weekly Timetable</h2>

        {/* Teacher legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {uniqueTeachers.filter(Boolean).map(t => t && (
            <span key={t.id} className={`px-2 py-0.5 rounded text-xs font-medium border ${teacherColors.get(t.id)}`}>
              {t.name}
            </span>
          ))}
        </div>

        {/* Day-by-day schedule */}
        <div className="space-y-6">
          {DAYS.map((day, dayIndex) => {
            const daySchedules = schedules.filter(s => s.day_of_week === dayIndex).sort((a, b) => a.start_time.localeCompare(b.start_time))
            if (daySchedules.length === 0) return null

            return (
              <div key={day}>
                <h3 className="font-semibold text-gray-700 mb-2">{day}</h3>
                <div className="bg-white rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-2 text-left font-medium">Time</th>
                        <th className="p-2 text-left font-medium">Room</th>
                        <th className="p-2 text-left font-medium">Subject</th>
                        <th className="p-2 text-left font-medium">Teacher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daySchedules.map(s => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="p-2 font-medium">{s.start_time} — {s.end_time}</td>
                          <td className="p-2">{s.room?.name}</td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${teacherColors.get(s.teacher_id)}`}>
                              {s.subject}
                            </span>
                          </td>
                          <td className="p-2">{s.teacher?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          Perseverance Learning Centre, Tawau, Sabah
        </div>
      </footer>
    </div>
  )
}
