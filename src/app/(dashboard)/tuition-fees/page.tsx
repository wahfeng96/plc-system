'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Teacher, Student, StudentSubject } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Search, CheckCircle, Clock, DollarSign } from 'lucide-react'

interface PaymentRecord {
  id: string
  student_id: string
  teacher_id: string
  month: string
  amount: number
  status: 'unpaid' | 'paid' | 'partial'
  paid_amount: number
  paid_date: string | null
  notes: string | null
}

interface StudentFeeRow {
  student: Student
  subjects: (StudentSubject & { teacher?: Teacher })[]
  totalFee: number
  payments: PaymentRecord[]
}

export default function TuitionFeesPage() {
  const { role, teacher } = useAuth()
  const supabase = createClient()

  const [rows, setRows] = useState<StudentFeeRow[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTeacher, setFilterTeacher] = useState('')
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [editPayment, setEditPayment] = useState<{ student: Student; teacherId: string; teacherName: string; month: string; amount: number; existing?: PaymentRecord } | null>(null)
  const [payForm, setPayForm] = useState({ status: 'paid' as string, paid_amount: 0, paid_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

    // Load teachers
    const { data: allTeachers } = await supabase.from('teachers').select('*').eq('status', 'active').order('name')
    setTeachers(allTeachers || [])

    // Load student_subjects with student + teacher
    let query = supabase
      .from('student_subjects')
      .select('*, student:students(*), teacher:teachers(*)')
      .eq('status', 'active')

    // Teacher only sees own students
    if (role === 'teacher' && teacher) {
      query = query.eq('teacher_id', teacher.id)
    }

    const { data: subs } = await query

    if (!subs) { setLoading(false); return }

    // Group by student
    const studentMap = new Map<string, StudentFeeRow>()
    for (const sub of subs) {
      if (!sub.student) continue
      const existing = studentMap.get(sub.student_id)
      if (existing) {
        existing.subjects.push(sub)
        existing.totalFee += sub.tuition_fee || 0
      } else {
        studentMap.set(sub.student_id, {
          student: sub.student,
          subjects: [sub],
          totalFee: sub.tuition_fee || 0,
          payments: [],
        })
      }
    }

    // Load payments for selected month
    const studentIds = Array.from(studentMap.keys())
    if (studentIds.length > 0) {
      const { data: payments } = await supabase
        .from('tuition_payments')
        .select('*')
        .in('student_id', studentIds)
        .eq('month', filterMonth)

      for (const p of (payments || []) as PaymentRecord[]) {
        const row = studentMap.get(p.student_id)
        if (row) row.payments.push(p)
      }
    }

    setRows(Array.from(studentMap.values()).sort((a, b) => a.student.name.localeCompare(b.student.name)))
    setLoading(false)
  }, [supabase, role, teacher, filterMonth])

  useEffect(() => { load() }, [load])

  function getPaymentForTeacher(row: StudentFeeRow, teacherId: string): PaymentRecord | undefined {
    return row.payments.find(p => p.teacher_id === teacherId)
  }

  function openPayment(student: Student, teacherId: string, teacherName: string, amount: number, existing?: PaymentRecord) {
    setEditPayment({ student, teacherId, teacherName, month: filterMonth, amount, existing })
    setPayForm({
      status: existing?.status || 'paid',
      paid_amount: existing?.paid_amount || amount,
      paid_date: existing?.paid_date || new Date().toISOString().split('T')[0],
      notes: existing?.notes || '',
    })
  }

  async function handleSavePayment() {
    if (!editPayment) return
    setSaving(true)

    const record = {
      student_id: editPayment.student.id,
      teacher_id: editPayment.teacherId,
      month: editPayment.month,
      amount: editPayment.amount,
      status: payForm.status,
      paid_amount: payForm.status === 'unpaid' ? 0 : payForm.paid_amount,
      paid_date: payForm.status === 'unpaid' ? null : payForm.paid_date,
      notes: payForm.notes || null,
    }

    if (editPayment.existing) {
      const { error } = await supabase.from('tuition_payments').update(record).eq('id', editPayment.existing.id)
      if (error) alert(`Error: ${error.message}`)
    } else {
      const { error } = await supabase.from('tuition_payments').insert(record)
      if (error) alert(`Error: ${error.message}`)
    }

    setSaving(false)
    setEditPayment(null)
    load()
  }

  // Filter
  const filtered = rows.filter(r => {
    const matchSearch = r.student.name.toLowerCase().includes(search.toLowerCase()) ||
      r.student.parent_name.toLowerCase().includes(search.toLowerCase())
    const matchTeacher = !filterTeacher || r.subjects.some(s => s.teacher_id === filterTeacher)
    return matchSearch && matchTeacher
  })

  // Stats
  const totalExpected = filtered.reduce((sum, r) => sum + r.totalFee, 0)
  const totalPaid = filtered.reduce((sum, r) => sum + r.payments.reduce((s, p) => s + p.paid_amount, 0), 0)
  const totalUnpaid = totalExpected - totalPaid

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Tuition Fees</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500">Expected</div>
            <div className="text-xl font-bold">RM {totalExpected.toFixed(0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500">Collected</div>
            <div className="text-xl font-bold text-green-600">RM {totalPaid.toFixed(0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-gray-500">Outstanding</div>
            <div className="text-xl font-bold text-red-600">RM {totalUnpaid.toFixed(0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Month</Label>
          <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-40 h-9" />
        </div>
        {role === 'admin' && (
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Teacher</Label>
            <select
              value={filterTeacher}
              onChange={e => setFilterTeacher(e.target.value)}
              className="h-9 rounded-lg border border-input bg-white px-3 text-sm min-w-[160px]"
            >
              <option value="">All Teachers</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1 flex-1 min-w-[150px]">
          <Label className="text-xs text-gray-500">Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Student or parent name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
      </div>

      {/* Student List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            No students found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            // Group subjects by teacher
            const byTeacher = new Map<string, { teacher: Teacher; subjects: typeof row.subjects; fee: number }>()
            for (const sub of row.subjects) {
              if (!sub.teacher) continue
              const existing = byTeacher.get(sub.teacher_id)
              if (existing) {
                existing.subjects.push(sub)
                existing.fee += sub.tuition_fee || 0
              } else {
                byTeacher.set(sub.teacher_id, { teacher: sub.teacher, subjects: [sub], fee: sub.tuition_fee || 0 })
              }
            }

            return (
              <Card key={row.student.id}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold">{row.student.name}</div>
                      <div className="text-xs text-gray-500">{row.student.form_level} · {row.student.parent_name} ({row.student.parent_phone})</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">RM {row.totalFee}/mo</div>
                      <div className="text-xs text-gray-500">{row.subjects.length} subject{row.subjects.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>

                  {/* Per-teacher breakdown */}
                  <div className="space-y-2 mt-3">
                    {Array.from(byTeacher.entries()).map(([tid, t]) => {
                      const payment = getPaymentForTeacher(row, tid)
                      const isPaid = payment?.status === 'paid'
                      const isPartial = payment?.status === 'partial'

                      return (
                        <div key={tid} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{t.teacher.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {t.subjects.map(s => s.subject).join(', ')} · RM {t.fee}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {isPaid ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">
                                <CheckCircle className="h-3 w-3 mr-1" /> Paid
                              </Badge>
                            ) : isPartial ? (
                              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200" variant="outline">
                                <Clock className="h-3 w-3 mr-1" /> RM{payment.paid_amount}
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-600 border-red-200" variant="outline">
                                Unpaid
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => openPayment(row.student, tid, t.teacher.name, t.fee, payment)}
                            >
                              {payment ? 'Edit' : 'Record'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={!!editPayment} onOpenChange={() => setEditPayment(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {editPayment && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">{editPayment.student.name}</div>
                <div className="text-gray-500">{editPayment.teacherName} · {editPayment.month}</div>
                <div className="text-gray-500">Fee: RM {editPayment.amount}</div>
              </div>

              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  value={payForm.status}
                  onChange={e => {
                    const s = e.target.value
                    setPayForm(f => ({
                      ...f,
                      status: s,
                      paid_amount: s === 'paid' ? editPayment.amount : s === 'unpaid' ? 0 : f.paid_amount,
                    }))
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  <option value="paid">✅ Paid</option>
                  <option value="partial">⏳ Partial</option>
                  <option value="unpaid">❌ Unpaid</option>
                </select>
              </div>

              {payForm.status !== 'unpaid' && (
                <>
                  <div className="space-y-1">
                    <Label>Amount Paid (RM)</Label>
                    <Input
                      type="number"
                      value={payForm.paid_amount}
                      onChange={e => setPayForm(f => ({ ...f, paid_amount: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={payForm.paid_date}
                      onChange={e => setPayForm(f => ({ ...f, paid_date: e.target.value }))}
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <Label>Notes</Label>
                <Input
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Cash / Transfer / Discount"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPayment(null)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSavePayment} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
