'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Teacher, TeacherInvoice } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { FileText, Plus, Eye, Printer, Trash2, ArrowLeft, Save, Check } from 'lucide-react'

type InvoiceWithTeacher = TeacherInvoice & { teacher?: Teacher }

// Editable form state mirrors TeacherInvoice fields
interface InvoiceForm {
  rental_rate_1: number
  rental_hours_1: number
  rental_rate_2: number
  rental_hours_2: number
  rental_rate_3: number
  rental_hours_3: number
  photocopy_price: number
  photocopy_prev_reading: number
  photocopy_curr_reading: number
  reg_fee_students: number
  reg_fee_per_student: number
  reg_fee_rebate: number
  overdue_amount: number
  overdue_description: string
  bank_name: string
  bank_account: string
  bank_account_name: string
  remark: string
}

function defaultForm(): InvoiceForm {
  return {
    rental_rate_1: 22,
    rental_hours_1: 0,
    rental_rate_2: 20,
    rental_hours_2: 0,
    rental_rate_3: 12,
    rental_hours_3: 0,
    photocopy_price: 0.05,
    photocopy_prev_reading: 0,
    photocopy_curr_reading: 0,
    reg_fee_students: 0,
    reg_fee_per_student: 50,
    reg_fee_rebate: 25,
    overdue_amount: 0,
    overdue_description: '',
    bank_name: 'RHB',
    bank_account: '26003200018111',
    bank_account_name: 'PERSEVERANCE LEARNING CENTRE',
    remark: 'Please make payment to Jaycie or bank transfer to the account above. Thank you.',
  }
}

function formFromInvoice(inv: TeacherInvoice): InvoiceForm {
  return {
    rental_rate_1: inv.rental_rate_1,
    rental_hours_1: inv.rental_hours_1,
    rental_rate_2: inv.rental_rate_2,
    rental_hours_2: inv.rental_hours_2,
    rental_rate_3: inv.rental_rate_3,
    rental_hours_3: inv.rental_hours_3,
    photocopy_price: inv.photocopy_price,
    photocopy_prev_reading: inv.photocopy_prev_reading,
    photocopy_curr_reading: inv.photocopy_curr_reading,
    reg_fee_students: inv.reg_fee_students,
    reg_fee_per_student: inv.reg_fee_per_student,
    reg_fee_rebate: inv.reg_fee_rebate,
    overdue_amount: inv.overdue_amount,
    overdue_description: inv.overdue_description,
    bank_name: inv.bank_name,
    bank_account: inv.bank_account,
    bank_account_name: inv.bank_account_name,
    remark: inv.remark,
  }
}

// Calculations
function calcRentalSubtotal(f: InvoiceForm) {
  return f.rental_rate_1 * f.rental_hours_1 + f.rental_rate_2 * f.rental_hours_2 + f.rental_rate_3 * f.rental_hours_3
}
function calcPhotocopyPages(f: InvoiceForm) {
  return Math.max(0, f.photocopy_curr_reading - f.photocopy_prev_reading)
}
function calcPhotocopySubtotal(f: InvoiceForm) {
  return calcPhotocopyPages(f) * f.photocopy_price
}
function calcRegFeeSubtotal(f: InvoiceForm) {
  return (f.reg_fee_per_student - f.reg_fee_rebate) * f.reg_fee_students
}
function calcGrandTotal(f: InvoiceForm) {
  return calcRentalSubtotal(f) + calcPhotocopySubtotal(f) + calcRegFeeSubtotal(f) + f.overdue_amount
}

function formatMonth(month: string) {
  const [y, m] = month.split('-')
  const date = new Date(Number(y), Number(m) - 1)
  return date.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' }).toUpperCase()
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
}

export default function InvoicesPage() {
  const supabase = createClient()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [invoices, setInvoices] = useState<InvoiceWithTeacher[]>([])
  const [loading, setLoading] = useState(true)

  // List view filters
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [filterStatus, setFilterStatus] = useState('')

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false)
  const [genMonth, setGenMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [genTeacher, setGenTeacher] = useState('')
  const [generating, setGenerating] = useState(false)

  // Detail/Edit view
  const [activeInvoice, setActiveInvoice] = useState<InvoiceWithTeacher | null>(null)
  const [form, setForm] = useState<InvoiceForm>(defaultForm())
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<InvoiceWithTeacher | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const [teachersRes, invoicesRes] = await Promise.all([
      supabase.from('teachers').select('*').eq('status', 'active').order('name'),
      supabase.from('teacher_invoices').select('*, teacher:teachers(*)').order('created_at', { ascending: false }),
    ])
    setTeachers(teachersRes.data || [])
    setInvoices(invoicesRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Open invoice detail
  function openInvoice(inv: InvoiceWithTeacher) {
    setActiveInvoice(inv)
    setForm(formFromInvoice(inv))
  }

  // Update a form field
  function setField<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // Parse number input, return 0 for empty/invalid
  function num(v: string) {
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }

  // Handle hours redistribution: when RM20 or RM12 hours change, subtract from RM22
  const totalAutoHours = useMemo(() => {
    if (!activeInvoice) return 0
    return activeInvoice.rental_hours_1 + activeInvoice.rental_hours_2 + activeInvoice.rental_hours_3
  }, [activeInvoice])

  function handleTier2HoursChange(val: string) {
    const newHours2 = num(val)
    const remainForTier1 = Math.max(0, totalAutoHours - newHours2 - form.rental_hours_3)
    setForm(prev => ({ ...prev, rental_hours_2: newHours2, rental_hours_1: remainForTier1 }))
  }

  function handleTier3HoursChange(val: string) {
    const newHours3 = num(val)
    const remainForTier1 = Math.max(0, totalAutoHours - form.rental_hours_2 - newHours3)
    setForm(prev => ({ ...prev, rental_hours_3: newHours3, rental_hours_1: remainForTier1 }))
  }

  // Generate invoice
  async function generateInvoice() {
    if (!genTeacher) return
    setGenerating(true)

    // Get class sessions for this teacher+month (non-cancelled)
    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('hours')
      .eq('teacher_id', genTeacher)
      .gte('date', `${genMonth}-01`)
      .lte('date', `${genMonth}-31`)
      .neq('status', 'cancelled')

    const totalHours = (sessions || []).reduce((sum, s) => sum + (s.hours || 0), 0)

    const defaults = defaultForm()
    const invoiceData = {
      teacher_id: genTeacher,
      month: genMonth,
      rental_rate_1: defaults.rental_rate_1,
      rental_hours_1: totalHours,
      rental_rate_2: defaults.rental_rate_2,
      rental_hours_2: 0,
      rental_rate_3: defaults.rental_rate_3,
      rental_hours_3: 0,
      photocopy_price: defaults.photocopy_price,
      photocopy_prev_reading: defaults.photocopy_prev_reading,
      photocopy_curr_reading: defaults.photocopy_curr_reading,
      reg_fee_students: defaults.reg_fee_students,
      reg_fee_per_student: defaults.reg_fee_per_student,
      reg_fee_rebate: defaults.reg_fee_rebate,
      overdue_amount: defaults.overdue_amount,
      overdue_description: defaults.overdue_description,
      bank_name: defaults.bank_name,
      bank_account: defaults.bank_account,
      bank_account_name: defaults.bank_account_name,
      remark: defaults.remark,
      status: 'draft',
    }

    const { data: created } = await supabase
      .from('teacher_invoices')
      .upsert(invoiceData, { onConflict: 'teacher_id,month' })
      .select('*, teacher:teachers(*)')
      .single()

    setGenerating(false)
    setGenerateOpen(false)
    setGenTeacher('')

    if (created) {
      await load()
      openInvoice(created)
    }
  }

  // Save invoice
  async function saveInvoice() {
    if (!activeInvoice) return
    setSaving(true)
    await supabase
      .from('teacher_invoices')
      .update({
        ...form,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeInvoice.id)

    const { data: updated } = await supabase
      .from('teacher_invoices')
      .select('*, teacher:teachers(*)')
      .eq('id', activeInvoice.id)
      .single()

    setSaving(false)
    if (updated) {
      setActiveInvoice(updated)
      setForm(formFromInvoice(updated))
    }
    await load()
  }

  // Update status
  async function updateStatus(status: 'issued' | 'paid') {
    if (!activeInvoice) return
    setSaving(true)
    const updates: Record<string, unknown> = { ...form, status, updated_at: new Date().toISOString() }
    if (status === 'issued') updates.issued_at = new Date().toISOString()
    if (status === 'paid') updates.paid_at = new Date().toISOString()

    await supabase.from('teacher_invoices').update(updates).eq('id', activeInvoice.id)

    const { data: updated } = await supabase
      .from('teacher_invoices')
      .select('*, teacher:teachers(*)')
      .eq('id', activeInvoice.id)
      .single()

    setSaving(false)
    if (updated) {
      setActiveInvoice(updated)
      setForm(formFromInvoice(updated))
    }
    await load()
  }

  // Delete invoice
  async function handleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    await supabase.from('teacher_invoices').delete().eq('id', deleteConfirm.id)
    setDeleting(false)
    setDeleteConfirm(null)
    setActiveInvoice(null)
    load()
  }

  function printInvoice() {
    window.print()
  }

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (filterMonth && inv.month !== filterMonth) return false
    if (filterStatus && inv.status !== filterStatus) return false
    return true
  })

  // Summary stats
  const totalDraft = invoices.filter(i => i.status === 'draft').length
  const totalIssued = invoices.filter(i => i.status === 'issued').length
  const totalPaid = invoices.filter(i => i.status === 'paid').length
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => {
    const f = formFromInvoice(i)
    return sum + calcGrandTotal(f)
  }, 0)

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  // ==================== DETAIL/EDIT VIEW ====================
  if (activeInvoice) {
    const rentalSub = calcRentalSubtotal(form)
    const photoPages = calcPhotocopyPages(form)
    const photoSub = calcPhotocopySubtotal(form)
    const regFeeSub = calcRegFeeSubtotal(form)
    const grandTotal = calcGrandTotal(form)

    return (
      <div>
        {/* Screen-only header */}
        <div className="flex items-center gap-3 mb-6 print:hidden">
          <Button variant="ghost" size="sm" onClick={() => setActiveInvoice(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold flex-1">
            Invoice — {activeInvoice.teacher?.name}
          </h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[activeInvoice.status]}`}>
            {activeInvoice.status}
          </span>
        </div>

        {/* Print-friendly invoice */}
        <div className="max-w-3xl mx-auto">
          <Card className="print:shadow-none print:border-none">
            <CardContent className="p-6 md:p-8 space-y-6">
              {/* Header */}
              <div className="text-center space-y-1">
                <h2 className="text-xl md:text-2xl font-bold tracking-wide">PERSEVERANCE LEARNING CENTRE</h2>
                <p className="text-sm text-gray-600 font-medium">TEACHER MONTHLY INVOICE</p>
                <p className="text-lg font-semibold text-blue-600">{formatMonth(activeInvoice.month)}</p>
                <p className="text-base font-medium">{activeInvoice.teacher?.name}</p>
              </div>

              <Separator />

              {/* Section 1: Room Rental */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Room Rental</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Rate (RM/hr)</TableHead>
                      <TableHead className="w-[120px]">Hours</TableHead>
                      <TableHead className="text-right">Amount (RM)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Tier 1 - RM22 default */}
                    <TableRow>
                      <TableCell>
                        <Input
                          type="number"
                          value={form.rental_rate_1}
                          onChange={e => setField('rental_rate_1', num(e.target.value))}
                          className="h-8 w-24 print:border-none print:p-0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium px-1">{form.rental_hours_1}</span>
                        <span className="text-xs text-gray-400 print:hidden"> (auto)</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(form.rental_rate_1 * form.rental_hours_1).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    {/* Tier 2 - RM20 */}
                    <TableRow>
                      <TableCell>
                        <Input
                          type="number"
                          value={form.rental_rate_2}
                          onChange={e => setField('rental_rate_2', num(e.target.value))}
                          className="h-8 w-24 print:border-none print:p-0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={form.rental_hours_2}
                          onChange={e => handleTier2HoursChange(e.target.value)}
                          className="h-8 w-20 print:border-none print:p-0"
                          min="0"
                          step="0.5"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(form.rental_rate_2 * form.rental_hours_2).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    {/* Tier 3 - RM12 */}
                    <TableRow>
                      <TableCell>
                        <Input
                          type="number"
                          value={form.rental_rate_3}
                          onChange={e => setField('rental_rate_3', num(e.target.value))}
                          className="h-8 w-24 print:border-none print:p-0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={form.rental_hours_3}
                          onChange={e => handleTier3HoursChange(e.target.value)}
                          className="h-8 w-20 print:border-none print:p-0"
                          min="0"
                          step="0.5"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(form.rental_rate_3 * form.rental_hours_3).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    {/* Subtotal */}
                    <TableRow className="bg-gray-50">
                      <TableCell colSpan={2} className="font-semibold">Subtotal</TableCell>
                      <TableCell className="text-right font-bold">{rentalSub.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Section 2: Photocopy Meter */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Photocopy Meter</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Price/page (RM)</Label>
                    <Input
                      type="number"
                      value={form.photocopy_price}
                      onChange={e => setField('photocopy_price', num(e.target.value))}
                      className="h-8 print:border-none print:p-0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Previous Reading</Label>
                    <Input
                      type="number"
                      value={form.photocopy_prev_reading}
                      onChange={e => setField('photocopy_prev_reading', num(e.target.value))}
                      className="h-8 print:border-none print:p-0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Current Reading</Label>
                    <Input
                      type="number"
                      value={form.photocopy_curr_reading}
                      onChange={e => setField('photocopy_curr_reading', num(e.target.value))}
                      className="h-8 print:border-none print:p-0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Pages Used</Label>
                    <div className="h-8 flex items-center text-sm font-medium">{photoPages}</div>
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-sm text-gray-500">Subtotal: </span>
                  <span className="font-bold">RM {photoSub.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              {/* Section 3: Registration Fee */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Registration Fee</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">No. of Students</Label>
                    <Input
                      type="number"
                      value={form.reg_fee_students}
                      onChange={e => setField('reg_fee_students', num(e.target.value))}
                      className="h-8 print:border-none print:p-0"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Fee/student (RM)</Label>
                    <Input
                      type="number"
                      value={form.reg_fee_per_student}
                      onChange={e => setField('reg_fee_per_student', num(e.target.value))}
                      className="h-8 print:border-none print:p-0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Rebate/student (RM)</Label>
                    <Input
                      type="number"
                      value={form.reg_fee_rebate}
                      onChange={e => setField('reg_fee_rebate', num(e.target.value))}
                      className="h-8 print:border-none print:p-0"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-sm text-gray-500">Subtotal: </span>
                  <span className="font-bold">RM {regFeeSub.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              {/* Section 4: Overdue Fee */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Overdue Fee</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Amount (RM)</Label>
                    <Input
                      type="number"
                      value={form.overdue_amount}
                      onChange={e => setField('overdue_amount', num(e.target.value))}
                      className="h-8 print:border-none print:p-0"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Description</Label>
                    <Input
                      value={form.overdue_description}
                      onChange={e => setField('overdue_description', e.target.value)}
                      className="h-8 print:border-none print:p-0"
                      placeholder="e.g. Outstanding balance from March"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Section 5: Summary */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Summary</h3>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Room Rental</TableCell>
                      <TableCell className="text-right">RM {rentalSub.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Photocopy</TableCell>
                      <TableCell className="text-right">RM {photoSub.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Registration Fee</TableCell>
                      <TableCell className="text-right">RM {regFeeSub.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Overdue Fee</TableCell>
                      <TableCell className="text-right">RM {form.overdue_amount.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-blue-50">
                      <TableCell className="font-bold text-blue-700">GRAND TOTAL</TableCell>
                      <TableCell className="text-right font-bold text-blue-700 text-lg">
                        RM {grandTotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Section 6: Bank Details */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Bank</Label>
                    <Input
                      value={form.bank_name}
                      onChange={e => setField('bank_name', e.target.value)}
                      className="h-8 print:border-none print:p-0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Account Number</Label>
                    <Input
                      value={form.bank_account}
                      onChange={e => setField('bank_account', e.target.value)}
                      className="h-8 print:border-none print:p-0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Account Name</Label>
                    <Input
                      value={form.bank_account_name}
                      onChange={e => setField('bank_account_name', e.target.value)}
                      className="h-8 print:border-none print:p-0"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Section 7: Remark */}
              <div>
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-3">Remark</h3>
                <Textarea
                  value={form.remark}
                  onChange={e => setField('remark', e.target.value)}
                  className="min-h-[60px] print:border-none print:p-0 print:resize-none"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action buttons (screen only) */}
          <div className="flex flex-wrap items-center gap-2 mt-4 print:hidden">
            {activeInvoice.status === 'draft' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 mr-auto"
                onClick={() => setDeleteConfirm(activeInvoice)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            )}
            <div className="flex flex-wrap gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={printInvoice}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                size="sm"
                onClick={saveInvoice}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              {activeInvoice.status === 'draft' && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                  onClick={() => updateStatus('issued')}
                  disabled={saving}
                >
                  <Check className="h-4 w-4 mr-1" /> Mark Issued
                </Button>
              )}
              {activeInvoice.status === 'issued' && (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  size="sm"
                  onClick={() => updateStatus('paid')}
                  disabled={saving}
                >
                  <Check className="h-4 w-4 mr-1" /> Mark Paid
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Invoice</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this draft invoice for <strong>{deleteConfirm?.teacher?.name}</strong> ({deleteConfirm?.month})? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Invoice'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ==================== LIST VIEW ====================
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setGenerateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Generate Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="cursor-pointer hover:ring-1 hover:ring-gray-200" onClick={() => setFilterStatus(filterStatus === 'draft' ? '' : 'draft')}>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-gray-500">Draft</div>
            <div className="text-xl font-bold">{totalDraft}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-1 hover:ring-blue-200" onClick={() => setFilterStatus(filterStatus === 'issued' ? '' : 'issued')}>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-blue-600">Issued</div>
            <div className="text-xl font-bold text-blue-600">{totalIssued}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-1 hover:ring-green-200" onClick={() => setFilterStatus(filterStatus === 'paid' ? '' : 'paid')}>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-green-600">Paid</div>
            <div className="text-xl font-bold text-green-600">{totalPaid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-gray-500">Paid Revenue</div>
            <div className="text-xl font-bold">RM {totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Month</Label>
          <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-40 h-8" />
        </div>
        {(filterMonth || filterStatus) && (
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => { setFilterMonth(''); setFilterStatus('') }}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead className="hidden md:table-cell">Rental</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map(inv => {
                const f = formFromInvoice(inv)
                const total = calcGrandTotal(f)
                const rental = calcRentalSubtotal(f)
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.month}</TableCell>
                    <TableCell>{inv.teacher?.name}</TableCell>
                    <TableCell className="hidden md:table-cell">RM {rental.toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">RM {total.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status]}`}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" onClick={() => openInvoice(inv)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No invoices found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Generate Invoice Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Teacher Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Month</Label>
              <Input type="month" value={genMonth} onChange={e => setGenMonth(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Teacher</Label>
              <select
                value={genTeacher}
                onChange={e => setGenTeacher(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Select teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-500">
              Auto-fills teaching hours from class sessions. All fields are editable after generation.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={generateInvoice} disabled={generating || !genTeacher}>
              {generating ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
