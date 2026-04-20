'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Teacher } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const RATE_PER_HOUR = 15
const RATE_PER_STUDENT = 5

interface TeacherRow {
  id: string
  name: string
  students: number
  hours: number
  studentsOverride: number | null
  hoursOverride: number | null
}

interface OverrideRecord {
  id: string
  teacher_id: string
  month: string
  students_override: number | null
  hours_override: number | null
}

export default function HeadcountRentalPage() {
  const { role } = useAuth()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const now = new Date()
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState(now.getMonth()) // 0-indexed
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [overrides, setOverrides] = useState<OverrideRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const monthKey = `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}`

  const load = useCallback(async () => {
    setLoading(true)

    // 1. Get all active teachers
    const { data: teacherData } = await supabase
      .from('teachers')
      .select('*')
      .eq('status', 'active')
      .order('name')

    const teacherList = (teacherData || []) as Teacher[]

    // 2. Count students per teacher (active enrollments)
    const { data: ssData } = await supabase
      .from('student_subjects')
      .select('teacher_id, student_id')
      .eq('status', 'active')

    const studentCounts: Record<string, Set<string>> = {}
    for (const ss of (ssData || [])) {
      if (!studentCounts[ss.teacher_id]) studentCounts[ss.teacher_id] = new Set()
      studentCounts[ss.teacher_id].add(ss.student_id)
    }

    // 3. Calculate hours per teacher for this month
    // Method: count class_sessions in the month, or fall back to schedule × weeks
    const monthStart = `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}-01`
    const lastDay = new Date(filterYear, filterMonth + 1, 0).getDate()
    const monthEnd = `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}-${lastDay}`

    // Try class_sessions first
    const { data: sessionsData } = await supabase
      .from('class_sessions')
      .select('teacher_id, hours')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .eq('status', 'completed')

    const sessionHours: Record<string, number> = {}
    for (const s of (sessionsData || [])) {
      sessionHours[s.teacher_id] = (sessionHours[s.teacher_id] || 0) + (s.hours || 2)
    }

    // Also get scheduled hours (for teachers without class_sessions)
    const { data: schedData } = await supabase
      .from('schedules')
      .select('teacher_id, start_time, end_time, day_of_week')
      .eq('status', 'active')

    const scheduledHours: Record<string, number> = {}
    for (const sch of (schedData || [])) {
      const start = parseTime(sch.start_time)
      const end = parseTime(sch.end_time)
      const hoursPerClass = (end - start) / 60
      // Count how many times this day_of_week occurs in the month
      const weeksInMonth = countDayInMonth(filterYear, filterMonth, sch.day_of_week)
      scheduledHours[sch.teacher_id] = (scheduledHours[sch.teacher_id] || 0) + (hoursPerClass * weeksInMonth)
    }

    // 4. Load overrides
    const { data: overrideData } = await supabase
      .from('headcount_overrides')
      .select('*')
      .eq('month', monthKey)

    setOverrides((overrideData || []) as OverrideRecord[])

    // Build rows
    const rows: TeacherRow[] = teacherList.map(t => {
      const override = (overrideData || []).find((o: OverrideRecord) => o.teacher_id === t.id)
      const calcStudents = studentCounts[t.id]?.size || 0
      const calcHours = sessionHours[t.id] || scheduledHours[t.id] || 0
      return {
        id: t.id,
        name: t.name,
        students: calcStudents,
        hours: Math.round(calcHours),
        studentsOverride: override?.students_override ?? null,
        hoursOverride: override?.hours_override ?? null,
      }
    })

    setTeachers(rows)
    setLoading(false)
  }, [filterYear, filterMonth, monthKey])

  useEffect(() => { load() }, [load])

  function parseTime(t: string): number {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  function countDayInMonth(year: number, month: number, dayOfWeek: number): number {
    let count = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month, d).getDay() === dayOfWeek) count++
    }
    return count
  }

  function getEffective(row: TeacherRow) {
    return {
      students: row.studentsOverride ?? row.students,
      hours: row.hoursOverride ?? row.hours,
    }
  }

  async function saveOverride(teacherId: string, field: 'students' | 'hours', value: string) {
    const num = value.trim() === '' ? null : parseInt(value)
    const row = teachers.find(t => t.id === teacherId)
    if (!row) return

    const existing = overrides.find(o => o.teacher_id === teacherId)
    const patch = field === 'students'
      ? { students_override: num }
      : { hours_override: num }

    if (existing) {
      await supabase.from('headcount_overrides').update(patch).eq('id', existing.id)
      setOverrides(prev => prev.map(o => o.id === existing.id ? { ...o, ...patch } : o))
    } else {
      const { data } = await supabase.from('headcount_overrides').insert({
        teacher_id: teacherId,
        month: monthKey,
        students_override: field === 'students' ? num : null,
        hours_override: field === 'hours' ? num : null,
      }).select().single()
      if (data) setOverrides(prev => [...prev, data as OverrideRecord])
    }

    setTeachers(prev => prev.map(t =>
      t.id === teacherId
        ? { ...t, [field === 'students' ? 'studentsOverride' : 'hoursOverride']: num }
        : t
    ))
    setEditingCell(null)
  }

  // Totals
  const totals = teachers.reduce((acc, row) => {
    const eff = getEffective(row)
    return { students: acc.students + eff.students, hours: acc.hours + eff.hours }
  }, { students: 0, hours: 0 })

  const totalRentalFee = totals.hours * RATE_PER_HOUR
  const totalHeadCountFee = totals.students * RATE_PER_STUDENT
  const totalToISM = totalRentalFee + totalHeadCountFee

  if (role !== 'admin') {
    return <div className="flex items-center justify-center py-12 text-gray-500">Admin access only.</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Headcount & Rental</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Month</Label>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-white px-3 text-sm w-28"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Year</Label>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-white px-3 text-sm w-24"
          >
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 w-12">No.</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 w-44">Total Students</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700 w-36">Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((row, idx) => {
                    const eff = getEffective(row)
                    return (
                      <tr key={row.id} className="border-b hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-4 text-gray-500 text-center">{idx + 1}</td>
                        <td className="py-3 px-4 font-medium">{row.name}</td>
                        <td className="py-3 px-4 text-center">
                          {editingCell === `${row.id}-students` ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => saveOverride(row.id, 'students', editValue)}
                              onKeyDown={e => { if (e.key === 'Enter') saveOverride(row.id, 'students', editValue); if (e.key === 'Escape') setEditingCell(null) }}
                              className="w-20 text-center mx-auto h-8"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => { setEditingCell(`${row.id}-students`); setEditValue(String(eff.students)) }}
                              className={`px-3 py-1 rounded cursor-pointer hover:bg-blue-100 ${row.studentsOverride !== null ? 'text-orange-600 font-semibold' : ''}`}
                              title={row.studentsOverride !== null ? `System: ${row.students}, Override: ${row.studentsOverride}. Click to edit.` : 'Click to override'}
                            >
                              {eff.students}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {editingCell === `${row.id}-hours` ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => saveOverride(row.id, 'hours', editValue)}
                              onKeyDown={e => { if (e.key === 'Enter') saveOverride(row.id, 'hours', editValue); if (e.key === 'Escape') setEditingCell(null) }}
                              className="w-20 text-center mx-auto h-8"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => { setEditingCell(`${row.id}-hours`); setEditValue(String(eff.hours)) }}
                              className={`px-3 py-1 rounded cursor-pointer hover:bg-blue-100 ${row.hoursOverride !== null ? 'text-orange-600 font-semibold' : ''}`}
                              title={row.hoursOverride !== null ? `System: ${row.hours}, Override: ${row.hoursOverride}. Click to edit.` : 'Click to override'}
                            >
                              {eff.hours}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Grand Total */}
                  <tr className="border-t-2 bg-gray-50 font-bold">
                    <td className="py-3 px-4" colSpan={2}>Grand Total</td>
                    <td className="py-3 px-4 text-center">{totals.students}</td>
                    <td className="py-3 px-4 text-center">{totals.hours}</td>
                  </tr>

                  {/* Summary rows */}
                  <tr className="bg-blue-50">
                    <td className="py-3 px-4 font-semibold text-blue-700" colSpan={3}>
                      Total Rental Fee <span className="font-normal text-xs text-gray-500">(Hours × RM{RATE_PER_HOUR}/hr)</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-blue-700">
                      RM {totalRentalFee.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="bg-green-50">
                    <td className="py-3 px-4 font-semibold text-green-700" colSpan={3}>
                      Total Head Count Fee <span className="font-normal text-xs text-gray-500">(Students × RM{RATE_PER_STUDENT}/student)</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-green-700">
                      RM {totalHeadCountFee.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="bg-red-50">
                    <td className="py-3 px-4 font-bold text-red-700" colSpan={3}>
                      Total Amount Paid to ISM
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-red-700">
                      RM {totalToISM.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-3">
        Orange numbers = manually overridden. Click any number to edit. Clear the field to reset to system-calculated value.
      </p>
    </div>
  )
}
