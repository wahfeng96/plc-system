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
import { Download } from 'lucide-react'

export default function AttendancePage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [sessions, setSessions] = useState<(ClassSession & { teacher?: Teacher; schedule?: { subject: string } })[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Attendance[]>>({})
  const [loading, setLoading] = useState(true)
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
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

      const map: Record<string, Attendance[]> = {}
      for (const a of att || []) {
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

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Attendance</h1>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

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
      </div>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map(s => {
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
                  </TableRow>
                )
              })}
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    No class sessions found for this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
