'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { ClassSession, Schedule, Room, Student } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Clock, ArrowLeft } from 'lucide-react'

type SessionWithDetails = ClassSession & { schedule?: Schedule & { subject?: string }; room?: Room }

export default function TakeAttendancePage() {
  const { teacher, userId } = useAuth()
  const [sessions, setSessions] = useState<SessionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null)
  const [students, setStudents] = useState<(Student & { attendance_status?: 'present' | 'absent' | 'late' })[]>([])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const loadSessions = useCallback(async () => {
    if (!teacher) { setLoading(false); return }

    // Get today's schedules
    const dayOfWeek = new Date().getDay()
    const { data: schedules } = await supabase
      .from('schedules')
      .select('*, room:rooms(*)')
      .eq('teacher_id', teacher.id)
      .eq('day_of_week', dayOfWeek)
      .eq('status', 'active')

    if (!schedules || schedules.length === 0) {
      setSessions([])
      setLoading(false)
      return
    }

    // Check if class_sessions already exist for today, create if not
    const { data: existingSessions } = await supabase
      .from('class_sessions')
      .select('*, schedule:schedules(subject), room:rooms(*)')
      .eq('teacher_id', teacher.id)
      .eq('date', today)

    if (existingSessions && existingSessions.length > 0) {
      setSessions(existingSessions)
    } else {
      // Auto-create sessions for today
      const newSessions = schedules.map(s => ({
        schedule_id: s.id,
        date: today,
        room_id: s.room_id,
        teacher_id: teacher.id,
        status: 'scheduled' as const,
        hours: 2,
        rental_amount: (s.room?.hourly_rate || 22) * 2,
      }))
      const { data: created } = await supabase
        .from('class_sessions')
        .insert(newSessions)
        .select('*, schedule:schedules(subject), room:rooms(*)')
      setSessions(created || [])
    }

    setLoading(false)
  }, [supabase, teacher, today])

  useEffect(() => { loadSessions() }, [loadSessions])

  async function selectSession(session: SessionWithDetails) {
    setSelectedSession(session)

    // Get students enrolled in this subject with this teacher
    const { data: studentSubs } = await supabase
      .from('student_subjects')
      .select('*, student:students(*)')
      .eq('teacher_id', teacher!.id)
      .eq('subject', session.schedule?.subject || '')
      .eq('status', 'active')

    // Get existing attendance
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('class_session_id', session.id)

    const attendanceMap = new Map(existing?.map(a => [a.student_id, a.status]) || [])

    const studentList = (studentSubs || [])
      .filter(ss => ss.student)
      .map(ss => ({
        ...ss.student!,
        attendance_status: (attendanceMap.get(ss.student_id) || undefined) as 'present' | 'absent' | 'late' | undefined,
      }))

    setStudents(studentList)
  }

  async function markAttendance(studentId: string, status: 'present' | 'absent' | 'late') {
    if (!selectedSession) return

    setStudents(prev => prev.map(s =>
      s.id === studentId ? { ...s, attendance_status: status } : s
    ))

    await supabase.from('attendance').upsert({
      class_session_id: selectedSession.id,
      student_id: studentId,
      status,
      marked_by: userId,
      marked_at: new Date().toISOString(),
    }, { onConflict: 'class_session_id,student_id' })
  }

  async function completeSession() {
    if (!selectedSession) return
    setSaving(true)
    await supabase.from('class_sessions').update({ status: 'completed' }).eq('id', selectedSession.id)
    setSaving(false)
    setSelectedSession(null)
    loadSessions()
  }

  if (!teacher) return <div className="text-center py-12 text-gray-500">No teacher profile linked</div>
  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  // Student list view for selected session
  if (selectedSession) {
    return (
      <div>
        <button onClick={() => setSelectedSession(null)} className="flex items-center gap-1 text-blue-600 mb-4 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to sessions
        </button>
        <div className="mb-4">
          <h1 className="text-xl font-bold">{selectedSession.schedule?.subject}</h1>
          <p className="text-sm text-gray-500">{selectedSession.room?.name} — {today}</p>
        </div>

        {students.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No students enrolled in this class
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {students.map(student => (
              <Card key={student.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-gray-500">{student.form_level}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => markAttendance(student.id, 'present')}
                        className={`p-2 rounded-lg transition-colors ${
                          student.attendance_status === 'present'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-green-100'
                        }`}
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => markAttendance(student.id, 'late')}
                        className={`p-2 rounded-lg transition-colors ${
                          student.attendance_status === 'late'
                            ? 'bg-yellow-500 text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-yellow-100'
                        }`}
                      >
                        <Clock className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => markAttendance(student.id, 'absent')}
                        className={`p-2 rounded-lg transition-colors ${
                          student.attendance_status === 'absent'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-red-100'
                        }`}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={completeSession} disabled={saving}>
            {saving ? 'Completing...' : 'Complete Session'}
          </Button>
        </div>
      </div>
    )
  }

  // Sessions list
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Take Attendance</h1>
      <p className="text-sm text-gray-500 mb-6">Today — {new Date().toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No classes scheduled for today
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <Card
              key={session.id}
              className="cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all"
              onClick={() => selectSession(session)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{session.schedule?.subject || 'Class'}</h3>
                    <p className="text-sm text-gray-500">{session.room?.name}</p>
                  </div>
                  <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                    {session.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
