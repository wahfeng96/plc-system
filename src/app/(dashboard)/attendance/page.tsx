'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Schedule, Student, ClassSession, Attendance } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DAYS } from '@/lib/types'
import { UserPlus, X } from 'lucide-react'

export default function AttendancePage() {
  const { role, teacher } = useAuth()
  const supabase = createClient()

  // State
  const [schedules, setSchedules] = useState<(Schedule & { room?: { name: string } })[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<string>('')
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<string, 'present' | 'absent' | 'late'>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [extraDates, setExtraDates] = useState<string[]>([])
  const [removedDates, setRemovedDates] = useState<string[]>([])
  const [showAddDate, setShowAddDate] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [addingStudent, setAddingStudent] = useState<string | null>(null)

  // Load schedules (teacher sees own, admin sees all)
  useEffect(() => {
    async function loadSchedules() {
      let query = supabase.from('schedules').select('*, room:rooms(name)').eq('status', 'active').order('day_of_week')
      if (role === 'teacher' && teacher) {
        query = query.eq('teacher_id', teacher.id)
      }
      const { data } = await query
      setSchedules(data || [])
      setLoading(false)
    }
    loadSchedules()
  }, [supabase, role, teacher])

  // Load attendance grid when schedule + month selected
  const loadGrid = useCallback(async () => {
    if (!selectedSchedule || !filterMonth) return

    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (!schedule) return

    setLoading(true)

    // 1. Get students enrolled in this class
    const { data: subs } = await supabase
      .from('student_subjects')
      .select('*, student:students(*)')
      .eq('teacher_id', schedule.teacher_id)
      .eq('subject', schedule.subject)
      .eq('status', 'active')
      .order('student(name)')

    const studentList = (subs || []).filter(s => s.student).map(s => s.student!) as Student[]
    setStudents(studentList)

    // 2. Get class sessions for this schedule in selected month
    const monthStart = `${filterMonth}-01`
    const monthEnd = `${filterMonth}-31`
    const { data: sess } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('schedule_id', selectedSchedule)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date')

    setSessions(sess || [])

    // 3. Get attendance records for these sessions
    if (sess && sess.length > 0) {
      const sessionIds = sess.map(s => s.id)
      const { data: att } = await supabase
        .from('attendance')
        .select('*')
        .in('class_session_id', sessionIds)

      // Build map: { studentId: { sessionId: status } }
      const map: Record<string, Record<string, 'present' | 'absent' | 'late'>> = {}
      for (const a of (att || []) as Attendance[]) {
        if (!map[a.student_id]) map[a.student_id] = {}
        map[a.student_id][a.class_session_id] = a.status
      }
      setAttendanceMap(map)
    } else {
      setAttendanceMap({})
    }

    setLoading(false)
  }, [supabase, selectedSchedule, filterMonth, schedules])

  useEffect(() => { loadGrid(); setExtraDates([]); setRemovedDates([]) }, [loadGrid])

  // Generate dates for the month based on schedule day_of_week + extra - removed
  function getScheduleDates(): string[] {
    if (!selectedSchedule || !filterMonth) return []
    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (!schedule) return []

    const [year, month] = filterMonth.split('-').map(Number)
    const dates: string[] = []
    const daysInMonth = new Date(year, month, 0).getDate()

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d)
      if (date.getDay() === schedule.day_of_week) {
        dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
      }
    }

    // Also include dates from existing sessions that aren't in the auto-generated list
    for (const s of sessions) {
      if (!dates.includes(s.date) && s.date.startsWith(filterMonth)) {
        dates.push(s.date)
      }
    }

    // Add extra dates
    for (const d of extraDates) {
      if (!dates.includes(d) && d.startsWith(filterMonth)) dates.push(d)
    }

    // Remove removed dates (only if no attendance data exists)
    const filtered = dates.filter(d => !removedDates.includes(d))

    return filtered.sort()
  }

  function addDate() {
    if (!newDate) return
    if (!extraDates.includes(newDate)) {
      setExtraDates(prev => [...prev, newDate])
      setRemovedDates(prev => prev.filter(d => d !== newDate))
    }
    setNewDate('')
    setShowAddDate(false)
  }

  function removeDate(date: string) {
    // Check if any attendance exists for this date
    const session = sessions.find(s => s.date === date)
    if (session) {
      const hasAttendance = Object.values(attendanceMap).some(m => m[session.id])
      if (hasAttendance) {
        if (!confirm(`This date has attendance data. Remove anyway?`)) return
        // Delete attendance + session
        supabase.from('attendance').delete().eq('class_session_id', session.id).then(() => {
          supabase.from('class_sessions').delete().eq('id', session.id).then(() => {
            setSessions(prev => prev.filter(s => s.id !== session.id))
            setAttendanceMap(prev => {
              const copy = { ...prev }
              for (const sid in copy) {
                const inner = { ...copy[sid] }
                delete inner[session.id]
                copy[sid] = inner
              }
              return copy
            })
          })
        })
      }
    }
    setRemovedDates(prev => [...prev, date])
    setExtraDates(prev => prev.filter(d => d !== date))
  }

  // Toggle attendance
  async function toggleAttendance(studentId: string, sessionId: string, date: string) {
    const currentStatus = attendanceMap[studentId]?.[sessionId]
    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (!schedule) return

    // Cycle: none → present → absent → none
    let newStatus: 'present' | 'absent' | null = null
    if (!currentStatus) newStatus = 'present'
    else if (currentStatus === 'present') newStatus = 'absent'
    else newStatus = null

    const cellKey = `${studentId}-${sessionId}`
    setSaving(cellKey)

    // Ensure class_session exists
    let actualSessionId = sessionId
    if (!sessionId || sessionId === 'new') {
      // Create session
      const { data: newSession } = await supabase
        .from('class_sessions')
        .insert({
          schedule_id: selectedSchedule,
          date,
          room_id: schedule.room_id,
          teacher_id: schedule.teacher_id,
          status: 'completed',
          hours: 2,
          rental_amount: 44,
        })
        .select()
        .single()

      if (newSession) {
        actualSessionId = newSession.id
        setSessions(prev => [...prev, newSession].sort((a, b) => a.date.localeCompare(b.date)))
      } else {
        setSaving(null)
        return
      }
    }

    if (newStatus) {
      await supabase.from('attendance').upsert({
        class_session_id: actualSessionId,
        student_id: studentId,
        status: newStatus,
        marked_by: teacher?.user_id || '',
        marked_at: new Date().toISOString(),
      }, { onConflict: 'class_session_id,student_id' })

      setAttendanceMap(prev => ({
        ...prev,
        [studentId]: { ...(prev[studentId] || {}), [actualSessionId]: newStatus! }
      }))
    } else {
      // Remove attendance
      await supabase.from('attendance')
        .delete()
        .eq('class_session_id', actualSessionId)
        .eq('student_id', studentId)

      setAttendanceMap(prev => {
        const copy = { ...prev }
        if (copy[studentId]) {
          const inner = { ...copy[studentId] }
          delete inner[actualSessionId]
          copy[studentId] = inner
        }
        return copy
      })
    }

    setSaving(null)
  }

  // Format date header: "7/2" style
  function fmtDate(dateStr: string) {
    const [, m, d] = dateStr.split('-')
    return `${parseInt(d)}/${parseInt(m)}`
  }

  async function openAddStudent() {
    // Load all active students not already in this class
    const { data } = await supabase.from('students').select('*').eq('status', 'active').order('name')
    setAllStudents(data || [])
    setAddStudentOpen(true)
  }

  async function assignStudent(studentId: string) {
    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (!schedule) return
    setAddingStudent(studentId)

    const { error } = await supabase.from('student_subjects').insert({
      student_id: studentId,
      teacher_id: schedule.teacher_id,
      subject: schedule.subject,
      exam_system: 'SPM',
      tuition_fee: 0,
      academic_year: new Date().getFullYear(),
      registered_by_admin: true,
      commission_start: new Date().toISOString().split('T')[0],
    })

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      // Reload grid
      await loadGrid()
    }
    setAddingStudent(null)
  }

  async function removeStudent(studentId: string) {
    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (!schedule) return
    if (!confirm('Remove this student from this class?')) return

    await supabase.from('student_subjects')
      .delete()
      .eq('student_id', studentId)
      .eq('teacher_id', schedule.teacher_id)
      .eq('subject', schedule.subject)

    await loadGrid()
  }

  const scheduleDates = getScheduleDates()
  const selectedSch = schedules.find(s => s.id === selectedSchedule)
  const enrolledIds = new Set(students.map(s => s.id))
  const availableStudents = allStudents.filter(s => !enrolledIds.has(s.id))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Attendance</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Class</Label>
          <select
            value={selectedSchedule}
            onChange={e => setSelectedSchedule(e.target.value)}
            className="h-9 rounded-lg border border-input bg-white px-3 text-sm min-w-[200px]"
          >
            <option value="">Select a class...</option>
            {schedules.map(s => (
              <option key={s.id} value={s.id}>
                {s.subject} — {DAYS[s.day_of_week]} {s.start_time}-{s.end_time} ({s.room?.name})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Month</Label>
          <Input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="w-40 h-9"
          />
        </div>
      </div>

      {/* Class Info */}
      {selectedSch && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{selectedSch.subject}</span>
            {' · '}
            {DAYS[selectedSch.day_of_week]} {selectedSch.start_time}–{selectedSch.end_time}
            {' · '}
            {selectedSch.room?.name}
            {' · '}
            {students.length} students
          </div>
          <Button size="sm" variant="outline" onClick={openAddStudent}>
            <UserPlus className="h-4 w-4 mr-1" /> Add Student
          </Button>
        </div>
      )}

      {/* Attendance Grid */}
      {!selectedSchedule ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Select a class to view attendance
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            No students enrolled in this class
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[40px]">No.</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-700 sticky left-[40px] bg-gray-50 min-w-[140px]">Name</th>
                    {scheduleDates.map(date => (
                      <th key={date} className="text-center py-1 px-1 font-semibold text-gray-700 min-w-[45px]">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-xs">{fmtDate(date)}</span>
                          <button
                            onClick={() => removeDate(date)}
                            className="text-[9px] text-gray-300 hover:text-red-500 transition-colors leading-none"
                            title="Remove date"
                          >
                            ✕
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="text-center py-3 px-1 min-w-[40px]">
                      {showAddDate ? (
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="date"
                            value={newDate}
                            onChange={e => setNewDate(e.target.value)}
                            className="w-[100px] text-xs border rounded px-1 py-0.5"
                            min={`${filterMonth}-01`}
                            max={`${filterMonth}-31`}
                          />
                          <div className="flex gap-1">
                            <button onClick={addDate} className="text-[10px] text-green-600 font-bold">✓</button>
                            <button onClick={() => setShowAddDate(false)} className="text-[10px] text-gray-400">✕</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddDate(true)}
                          className="text-lg text-gray-300 hover:text-blue-500 transition-colors"
                          title="Add date"
                        >
                          +
                        </button>
                      )}
                    </th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700 min-w-[50px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    // Count present for this student
                    const studentAtt = attendanceMap[student.id] || {}
                    const presentCount = Object.values(studentAtt).filter(s => s === 'present').length

                    return (
                      <tr key={student.id} className="border-b hover:bg-blue-50/30 transition-colors">
                        <td className="py-2.5 px-3 text-gray-500 sticky left-0 bg-white">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium sticky left-[40px] bg-white">
                          <div className="flex items-center gap-1">
                            <span>{student.name}</span>
                            <button
                              onClick={() => removeStudent(student.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors ml-1"
                              title="Remove from class"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                        {scheduleDates.map(date => {
                          // Find session for this date
                          const session = sessions.find(s => s.date === date)
                          const sessionId = session?.id || 'new'
                          const status = session ? (attendanceMap[student.id]?.[session.id]) : undefined
                          const cellKey = `${student.id}-${sessionId}`
                          const isSaving = saving === cellKey

                          return (
                            <td key={date} className="py-2.5 px-2 text-center">
                              <button
                                onClick={() => toggleAttendance(student.id, sessionId, date)}
                                disabled={isSaving}
                                className={`w-8 h-8 rounded-md text-sm font-bold transition-all ${
                                  isSaving ? 'opacity-50' :
                                  status === 'present' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                  status === 'absent' ? 'bg-red-100 text-red-600 hover:bg-red-200' :
                                  'bg-gray-50 text-gray-300 hover:bg-gray-100'
                                }`}
                              >
                                {status === 'present' ? '1' : status === 'absent' ? '0' : '·'}
                              </button>
                            </td>
                          )
                        })}
                        <td className="py-2.5 px-1"></td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-600">
                          {presentCount}/{scheduleDates.length}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Student to Class Dialog */}
      <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Student to Class</DialogTitle>
          </DialogHeader>
          {selectedSch && (
            <p className="text-sm text-gray-500 mb-2">
              {selectedSch.subject} — {DAYS[selectedSch.day_of_week]} {selectedSch.start_time}–{selectedSch.end_time}
            </p>
          )}
          {availableStudents.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              {allStudents.length === 0 ? 'No students registered yet. Add students first.' : 'All students are already in this class.'}
            </p>
          ) : (
            <div className="space-y-2">
              {availableStudents.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.form_level}</div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => assignStudent(s.id)}
                    disabled={addingStudent === s.id}
                  >
                    {addingStudent === s.id ? '...' : '+ Add'}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStudentOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
