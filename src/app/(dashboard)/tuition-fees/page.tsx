'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Schedule, Student, Teacher } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { DAYS } from '@/lib/types'

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const EXTRA_FEES = [
  { key: 'REG', label: 'Reg Fee', default: 50 },
  { key: 'MAT', label: 'Mat Fee', default: 50 },
]
const ALL_COLUMNS = [
  ...EXTRA_FEES.map(f => ({ key: f.key, label: f.label, defaultFee: f.default })),
  ...MONTHS.map((m, i) => ({ key: String(i + 1).padStart(2, '0'), label: m, defaultFee: 100 })),
]

interface PaymentRecord {
  id: string
  student_id: string
  teacher_id: string
  month: string // '2026-01'
  amount: number
  status: 'unpaid' | 'paid'
  paid_amount: number
  paid_date: string | null
  notes: string | null
}

export default function TuitionFeesPage() {
  const { role, teacher } = useAuth()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [schedules, setSchedules] = useState<(Schedule & { room?: { name: string }, teacher?: Teacher })[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [filterYear, setFilterYear] = useState(() => new Date().getFullYear())
  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [monthlyFees, setMonthlyFees] = useState<Record<string, number>>({}) // { '2026-01': 100, ... }
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingFee, setEditingFee] = useState<string | null>(null)
  const [feeInput, setFeeInput] = useState('')

  // Load schedules
  useEffect(() => {
    async function loadSchedules() {
      let query = supabase.from('schedules').select('*, room:rooms(name), teacher:teachers(*)').eq('status', 'active').order('day_of_week')
      if (role === 'teacher' && teacher) {
        query = query.eq('teacher_id', teacher.id)
      }
      const { data } = await query
      setSchedules(data || [])
      setLoading(false)
    }
    loadSchedules()
  }, [role, teacher])

  // Load grid data when schedule + year selected
  const loadGrid = useCallback(async () => {
    if (!selectedSchedule) return
    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (!schedule) return

    setLoading(true)

    // 1. Get enrolled students
    const { data: subs } = await supabase
      .from('student_subjects')
      .select('*, student:students(*)')
      .eq('teacher_id', schedule.teacher_id)
      .eq('subject', schedule.subject)
      .eq('status', 'active')
      .order('student(name)')

    const studentList = (subs || []).filter(s => s.student).map(s => s.student!) as Student[]
    setStudents(studentList)

    // 2. Load all payments for these students + this teacher for the year
    if (studentList.length > 0) {
      const studentIds = studentList.map(s => s.id)
      const { data: payData } = await supabase
        .from('tuition_payments')
        .select('*')
        .in('student_id', studentIds)
        .eq('teacher_id', schedule.teacher_id)
        .like('month', `${filterYear}-%`)

      setPayments((payData || []) as PaymentRecord[])

      // Extract monthly fees from existing payments (use first found amount per month)
      const fees: Record<string, number> = {}
      for (const p of (payData || []) as PaymentRecord[]) {
        if (!fees[p.month] && p.amount > 0) {
          fees[p.month] = p.amount
        }
      }
      for (const col of ALL_COLUMNS) {
        const key = `${filterYear}-${col.key}`
        if (!fees[key]) fees[key] = col.defaultFee
      }
      setMonthlyFees(fees)
    } else {
      setPayments([])
      const fees: Record<string, number> = {}
      for (const col of ALL_COLUMNS) {
        fees[`${filterYear}-${col.key}`] = col.defaultFee
      }
      setMonthlyFees(fees)
    }

    setLoading(false)
  }, [selectedSchedule, filterYear, schedules])

  useEffect(() => { loadGrid() }, [loadGrid])

  // Get payment for student+month
  function getPayment(studentId: string, monthKey: string): PaymentRecord | undefined {
    return payments.find(p => p.student_id === studentId && p.month === monthKey)
  }

  // Toggle payment status
  async function togglePayment(studentId: string, monthKey: string) {
    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (!schedule) return

    const existing = getPayment(studentId, monthKey)
    const col = ALL_COLUMNS.find(c => monthKey.endsWith(`-${c.key}`))
    const fee = monthlyFees[monthKey] || col?.defaultFee || 100
    const cellKey = `${studentId}-${monthKey}`
    setSaving(cellKey)

    if (existing) {
      if (existing.status === 'paid') {
        // Toggle to unpaid
        await supabase.from('tuition_payments').update({
          status: 'unpaid',
          paid_amount: 0,
          paid_date: null,
        }).eq('id', existing.id)

        setPayments(prev => prev.map(p =>
          p.id === existing.id ? { ...p, status: 'unpaid' as const, paid_amount: 0, paid_date: null } : p
        ))
      } else {
        // Toggle to paid
        const today = new Date().toISOString().split('T')[0]
        await supabase.from('tuition_payments').update({
          status: 'paid',
          paid_amount: fee,
          paid_date: today,
        }).eq('id', existing.id)

        setPayments(prev => prev.map(p =>
          p.id === existing.id ? { ...p, status: 'paid' as const, paid_amount: fee, paid_date: today } : p
        ))
      }
    } else {
      // Create new — mark as paid
      const today = new Date().toISOString().split('T')[0]
      const { data: newRecord } = await supabase.from('tuition_payments').insert({
        student_id: studentId,
        teacher_id: schedule.teacher_id,
        month: monthKey,
        amount: fee,
        status: 'paid',
        paid_amount: fee,
        paid_date: today,
      }).select().single()

      if (newRecord) {
        setPayments(prev => [...prev, newRecord as PaymentRecord])
      }
    }

    setSaving(null)
  }

  // Update monthly fee
  async function saveFee(monthKey: string) {
    const newFee = parseFloat(feeInput)
    if (isNaN(newFee) || newFee < 0) {
      setEditingFee(null)
      return
    }

    setMonthlyFees(prev => ({ ...prev, [monthKey]: newFee }))

    // Update all existing payment records for this month to use new amount
    const schedule = schedules.find(s => s.id === selectedSchedule)
    if (schedule) {
      const monthPayments = payments.filter(p => p.month === monthKey)
      for (const p of monthPayments) {
        await supabase.from('tuition_payments').update({
          amount: newFee,
          paid_amount: p.status === 'paid' ? newFee : p.paid_amount,
        }).eq('id', p.id)
      }
      // Update local state
      setPayments(prev => prev.map(p =>
        p.month === monthKey ? { ...p, amount: newFee, paid_amount: p.status === 'paid' ? newFee : p.paid_amount } : p
      ))
    }

    setEditingFee(null)
  }

  // Stats
  const totalExpected = students.length > 0
    ? Object.values(monthlyFees).reduce((sum, fee) => sum + fee * students.length, 0)
    : 0
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.paid_amount, 0)

  const selectedSch = schedules.find(s => s.id === selectedSchedule)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Tuition Fees</h1>

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
                {s.subject} — {DAYS[s.day_of_week]} {s.start_time}-{s.end_time} {s.room?.name ? `(${s.room.name})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Year</Label>
          <select
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
            className="h-9 rounded-lg border border-input bg-white px-3 text-sm w-24"
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary stats */}
      {selectedSch && students.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-gray-500">Expected (Year)</div>
              <div className="text-lg font-bold">RM {totalExpected.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-gray-500">Collected</div>
              <div className="text-lg font-bold text-green-600">RM {totalPaid.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-gray-500">Outstanding</div>
              <div className="text-lg font-bold text-red-600">RM {(totalExpected - totalPaid).toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Info */}
      {selectedSch && (
        <div className="text-sm text-gray-600 mb-4">
          <span className="font-medium text-gray-900">{selectedSch.subject}</span>
          {' · '}{DAYS[selectedSch.day_of_week]} {selectedSch.start_time}–{selectedSch.end_time}
          {selectedSch.teacher && <> · {selectedSch.teacher.name}</>}
          {' · '}{students.length} students
        </div>
      )}

      {/* Grid */}
      {!selectedSchedule ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            Select a class to view tuition fees
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
                  {/* Column headers */}
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-3 font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-[40px]">No.</th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-700 sticky left-[40px] bg-gray-50 min-w-[120px]">Student</th>
                    {ALL_COLUMNS.map((col) => {
                      const isExtra = EXTRA_FEES.some(f => f.key === col.key)
                      return (
                        <th key={col.key} className={`text-center py-2 px-1 font-semibold min-w-[52px] ${isExtra ? 'text-purple-700 bg-purple-50/50' : 'text-gray-700'}`}>
                          <div className="text-xs">{col.label}</div>
                        </th>
                      )
                    })}
                  </tr>
                  {/* Fee row */}
                  <tr className="border-b bg-blue-50/50">
                    <td className="py-1 px-3 sticky left-0 bg-blue-50/50" colSpan={2}>
                      <span className="text-xs text-blue-600 font-medium">Fee (RM)</span>
                    </td>
                    {ALL_COLUMNS.map((col) => {
                      const monthKey = `${filterYear}-${col.key}`
                      const fee = monthlyFees[monthKey] || col.defaultFee
                      const isEditing = editingFee === monthKey
                      const isExtra = EXTRA_FEES.some(f => f.key === col.key)
                      return (
                        <td key={col.key} className={`py-1 px-1 text-center ${isExtra ? 'bg-purple-50/30' : ''}`}>
                          {isEditing ? (
                            <input
                              type="number"
                              value={feeInput}
                              onChange={e => setFeeInput(e.target.value)}
                              onBlur={() => saveFee(monthKey)}
                              onKeyDown={e => { if (e.key === 'Enter') saveFee(monthKey); if (e.key === 'Escape') setEditingFee(null) }}
                              className="w-12 text-center text-xs border rounded px-1 py-0.5"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => { setEditingFee(monthKey); setFeeInput(String(fee)) }}
                              className={`text-xs font-medium cursor-pointer ${isExtra ? 'text-purple-600 hover:text-purple-800' : 'text-blue-600 hover:text-blue-800'}`}
                              title="Click to edit fee"
                            >
                              {fee}
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    return (
                      <tr key={student.id} className="border-b hover:bg-blue-50/30 transition-colors">
                        <td className="py-2 px-3 text-gray-500 sticky left-0 bg-white text-center">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium sticky left-[40px] bg-white">
                          <div className="truncate max-w-[120px]" title={student.name}>{student.name}</div>
                        </td>
                        {ALL_COLUMNS.map((col) => {
                          const monthKey = `${filterYear}-${col.key}`
                          const payment = getPayment(student.id, monthKey)
                          const isPaid = payment?.status === 'paid'
                          const cellKey = `${student.id}-${monthKey}`
                          const isSaving = saving === cellKey
                          const isExtra = EXTRA_FEES.some(f => f.key === col.key)

                          return (
                            <td key={col.key} className={`py-2 px-1 text-center ${isExtra ? 'bg-purple-50/20' : ''}`}>
                              <button
                                onClick={() => togglePayment(student.id, monthKey)}
                                disabled={isSaving}
                                className={`w-9 h-8 rounded-md text-xs font-bold transition-all ${
                                  isSaving ? 'opacity-50' :
                                  isPaid ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                  'bg-red-50 text-red-400 hover:bg-red-100'
                                }`}
                                title={isPaid ? `Paid on ${payment?.paid_date || ''}` : 'Unpaid — tap to mark paid'}
                              >
                                {isPaid ? '✓' : '✗'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
