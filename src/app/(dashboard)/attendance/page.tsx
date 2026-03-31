'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Teacher, ClassSession, Attendance } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Download, Search, Users, CheckCircle, XCircle, Clock, Eye } from 'lucide-react'

type AttendanceWithStudent = Omit<Attendance, 'student'> & {
  student?: { name: string }
}

export default function AttendancePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [sessions, setSessions] = useState<(ClassSession & { teacher?: Teacher; schedule?: { subject: string } })[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceWithStudent[]>>({})
  const [loading, setLoading] = useState(true)
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterStudent, setFilterStudent] = useState('')
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [detailSession, setDetailSession] = useState<(ClassSession & { teacher?: Teacher; schedule?: { subject: string } }) | null>(null)
  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const [teachersRes, sessionsRes] = await Promise.all([
      supabase.from('teachers').select('*').eq('status', 'active').order('name'),
      supabase.from('class_sessions')
        .select('*, teacher:teachers(*), schedule:schedules(subject)')
        .gte('date', `${filterMonth}-01`)
        .lte('date', `${filterMonth}-31`)
        .order('date', { ascending: false }),
    ])
    setTeachers(teachersRes.data || [])

    let filtered = sessionsRes.data || []
    if (filterTeacher) {
      filtered = filtered.filter(s => s.teacher_id === filterTeacher)
    }
    setSessions(filtered)

    // Load attendance for all sessions
    if (filtered.length > 0) {
      const sessionIds = filtered.map(s => s.id)
      const { data: att } = await supabase
        .from('attendance')
        .select('*, student:students(name)')
        .in('class_session_id', sessionIds)

      const map: Record<string, AttendanceWithStudent[]> = {}
      for (const a of (att || []) as AttendanceWithStudent[]) {
        if (!map[a.class_session_id]) map[a.class_session_id] = []
        map[a.class_session_id].push(a)
      }
      setAttendanceMap(map)
    } else {
      setAttendanceMap({})
    }

    setLoading(false)
  }, [supabase, filterTeacher, filterMonth])

  useEffect(() => { load() }, [load])

  function exportCSV() {
    const rows = [['Date', 'Teacher', 'Subject', 'Present', 'Absent', 'Late']]
    for (const s of sessions) {
      const att = attendanceMap[s.id] || []
      const present = att.filter(a => a.status === 'present').length
      const absent = att.filter(a => a.status === 'absent').length
      const late = att.filter(a => a.status === 'late').length
      rows.push([s.date, s.teacher?.name || '', s.schedule?.subject || '', String(present), String(absent), String(late)])
    }
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${filterMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Compute summary by teacher
  const teacherSummary: Record<string, { name: string; total: number; present: number; absent: number; late: number }> = {}
  for (const s of sessions) {
    const tName = s.teacher?.name || 'Unknown'
    const tId = s.teacher_id
    if (!teacherSummary[tId]) teacherSummary[tId] = { name: tName, total: 0, present: 0, absent: 0, late: 0 }
    const att = attendanceMap[s.id] || []
    teacherSummary[tId].total += att.length
    teacherSummary[tId].present += att.filter(a => a.status === 'present').length
    teacherSummary[tId].absent += att.filter(a => a.status === 'absent').length
    teacherSummary[tId].late += att.filter(a => a.status === 'late').length
  }

  // Filter sessions by student name if set
  const filteredSessions = filterStudent
    ? sessions.filter(s => {
        const att = attendanceMap[s.id] || []
        return att.some(a => a.student?.name?.toLowerCase().includes(filterStudent.toLowerCase()))
      })
    : sessions

  const detailAttendance = detailSession ? (attendanceMap[detailSession.id] || []) : []

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Month</Label>
          <Input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Teacher</Label>
          <select
            value={filterTeacher}
            onChange={e => setFilterTeacher(e.target.value)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">All teachers</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Student</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
            <Input
              placeholder="Search student..."
              value={filterStudent}
              onChange={e => setFilterStudent(e.target.value)}
              className="pl-7 w-40 h-8"
            />
          </div>
        </div>
      </div>

      {/* Summary by Teacher */}
      {Object.keys(teacherSummary).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {Object.values(teacherSummary).map(ts => {
            const pct = ts.total > 0 ? Math.round((ts.present / ts.total) * 100) : 0
            return (
              <Card key={ts.name}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{ts.name}</span>
                    <span className="text-xs text-gray-500">{ts.total} records</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-3 w-3" /> {ts.present} ({pct}%)
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-3 w-3" /> {ts.absent}
                    </span>
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Clock className="h-3 w-3" /> {ts.late}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                    {ts.total > 0 && (
                      <>
                        <div className="bg-green-500 h-full" style={{ width: `${(ts.present / ts.total) * 100}%` }} />
                        <div className="bg-yellow-500 h-full" style={{ width: `${(ts.late / ts.total) * 100}%` }} />
                        <div className="bg-red-500 h-full" style={{ width: `${(ts.absent / ts.total) * 100}%` }} />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Sessions Table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map(s => {
                const att = attendanceMap[s.id] || []
                const present = att.filter(a => a.status === 'present').length
                const absent = att.filter(a => a.status === 'absent').length
                const late = att.filter(a => a.status === 'late').length
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.date}</TableCell>
                    <TableCell>{s.teacher?.name}</TableCell>
                    <TableCell>{s.schedule?.subject}</TableCell>
                    <TableCell><span className="text-green-600 font-medium">{present}</span></TableCell>
                    <TableCell><span className="text-red-600 font-medium">{absent}</span></TableCell>
                    <TableCell><span className="text-yellow-600 font-medium">{late}</span></TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDetailSession(s)} title="View students">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredSessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    No class sessions found for this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Session Detail Dialog - shows individual student attendance */}
      <Dialog open={!!detailSession} onOpenChange={() => setDetailSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {detailSession?.schedule?.subject} — {detailSession?.date}
            </DialogTitle>
          </DialogHeader>
          {detailSession && (
            <div className="space-y-3">
              <div className="text-sm text-gray-500">
                Teacher: {detailSession.teacher?.name}
              </div>
              {detailAttendance.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No attendance records for this session</p>
              ) : (
                <div className="space-y-2">
                  {detailAttendance.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{a.student?.name || 'Unknown'}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          a.status === 'present' ? 'text-green-600 bg-green-50' :
                          a.status === 'absent' ? 'text-red-600 bg-red-50' :
                          'text-yellow-600 bg-yellow-50'
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-t text-xs text-gray-500 flex gap-4">
                    <span className="text-green-600">{detailAttendance.filter(a => a.status === 'present').length} present</span>
                    <span className="text-red-600">{detailAttendance.filter(a => a.status === 'absent').length} absent</span>
                    <span className="text-yellow-600">{detailAttendance.filter(a => a.status === 'late').length} late</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
