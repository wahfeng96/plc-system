'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Teacher, TeacherInvoice, PhotocopyRow, RegFeeRow, ReferralRow } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FileText, Plus, Eye, Printer, Trash2, ArrowLeft, Save, Check, X } from 'lucide-react'

type InvoiceWithTeacher = TeacherInvoice & { teacher?: Teacher }

interface InvoiceForm {
  rental_rate_1: number
  rental_hours_1: number
  rental_rate_2: number
  rental_hours_2: number
  rental_rate_3: number
  rental_hours_3: number
  photocopy_rows: PhotocopyRow[]
  reg_fee_rows: RegFeeRow[]
  referral_rows: ReferralRow[]
  overdue_amount: number
  overdue_description: string
  bank_name: string
  bank_account: string
  bank_account_name: string
  remark: string
  payment_status: string
  payment_date: string
}

function defaultPhotocopyRow(): PhotocopyRow {
  return { label: 'RM0.08 per copy', price: 0.08, prev_reading: 0, curr_reading: 0 }
}

function defaultRegFeeRow(): RegFeeRow {
  return { label: 'RM100 per student (Rebate RM25 per student)', students: 0, fee: 100, rebate: 25 }
}

function defaultReferralRow(): ReferralRow {
  return { description: 'RM120', amount: 120, percentage: 10, referral_fee: 12 }
}

function defaultForm(): InvoiceForm {
  return {
    rental_rate_1: 22,
    rental_hours_1: 0,
    rental_rate_2: 20,
    rental_hours_2: 0,
    rental_rate_3: 12,
    rental_hours_3: 0,
    photocopy_rows: [{ label: 'RM0.08 per copy', price: 0.08, prev_reading: 0, curr_reading: 0 }],
    reg_fee_rows: [
      { label: 'RM100 per student (Rebate RM25 per student)', students: 0, fee: 100, rebate: 25 },
      { label: 'RM50 per student (Rebate RM25 per student)', students: 0, fee: 50, rebate: 25 },
    ],
    referral_rows: [],
    overdue_amount: 0,
    overdue_description: '',
    bank_name: 'RHB',
    bank_account: '26003200018111',
    bank_account_name: 'Perseverance All-Round Tuition Centre',
    remark: 'After payment, please send the receipt to Jaycie (017-2031551) through WhatsApp. Thank you.',
    payment_status: '',
    payment_date: '',
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
    photocopy_rows: (inv.photocopy_rows && inv.photocopy_rows.length > 0) ? inv.photocopy_rows : [defaultPhotocopyRow()],
    reg_fee_rows: (inv.reg_fee_rows && inv.reg_fee_rows.length > 0) ? inv.reg_fee_rows : defaultForm().reg_fee_rows,
    referral_rows: (inv.referral_rows && inv.referral_rows.length > 0) ? inv.referral_rows : [],
    overdue_amount: inv.overdue_amount,
    overdue_description: inv.overdue_description,
    bank_name: inv.bank_name,
    bank_account: inv.bank_account,
    bank_account_name: inv.bank_account_name,
    remark: inv.remark,
    payment_status: inv.payment_status || '',
    payment_date: inv.payment_date || '',
  }
}

// Calculations
function calcRentalSubtotal(f: InvoiceForm) {
  return f.rental_rate_1 * f.rental_hours_1 + f.rental_rate_2 * f.rental_hours_2 + f.rental_rate_3 * f.rental_hours_3
}
function calcPhotocopyRowCopies(row: PhotocopyRow) {
  return Math.max(0, row.curr_reading - row.prev_reading)
}
function calcPhotocopyRowAmount(row: PhotocopyRow) {
  return calcPhotocopyRowCopies(row) * row.price
}
function calcPhotocopySubtotal(f: InvoiceForm) {
  return f.photocopy_rows.reduce((sum, row) => sum + calcPhotocopyRowAmount(row), 0)
}
function calcRegFeeRowSubtotal(row: RegFeeRow) {
  return (row.fee - row.rebate) * row.students
}
function calcRegFeeSubtotal(f: InvoiceForm) {
  return f.reg_fee_rows.reduce((sum, row) => sum + calcRegFeeRowSubtotal(row), 0)
}
function calcReferralRowFee(row: ReferralRow) {
  return row.amount * row.percentage / 100
}
function calcReferralSubtotal(f: InvoiceForm) {
  return f.referral_rows.reduce((sum, row) => sum + calcReferralRowFee(row), 0)
}
function calcGrandTotal(f: InvoiceForm) {
  return calcRentalSubtotal(f) + calcPhotocopySubtotal(f) + calcRegFeeSubtotal(f) + calcReferralSubtotal(f) + f.overdue_amount
}

function formatMonthTitle(month: string) {
  const [y, m] = month.split('-')
  const date = new Date(Number(y), Number(m) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatIssuedDate(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const day = d.getDate()
  const suffix = (day > 3 && day < 21) ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] || 'th'
  const month = d.toLocaleDateString('en-US', { month: 'long' })
  return `${day}${suffix} ${month} ${d.getFullYear()}`
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  issued: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
}

// Common cell styles for the invoice tables
const thCls = 'border border-black p-2 text-sm font-bold'
const tdCls = 'border border-black p-2 text-sm'
const inputCls = 'h-7 w-full rounded border border-gray-300 px-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400'
const numInputCls = inputCls + ' text-center'

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

  function openInvoice(inv: InvoiceWithTeacher) {
    setActiveInvoice(inv)
    setForm(formFromInvoice(inv))
  }

  function setField<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function num(v: string) {
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }

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

  // Row updaters
  function updatePhotocopyRow(idx: number, patch: Partial<PhotocopyRow>) {
    setForm(prev => ({
      ...prev,
      photocopy_rows: prev.photocopy_rows.map((r, i) => i === idx ? { ...r, ...patch } : r),
    }))
  }

  function updateRegFeeRow(idx: number, patch: Partial<RegFeeRow>) {
    setForm(prev => ({
      ...prev,
      reg_fee_rows: prev.reg_fee_rows.map((r, i) => i === idx ? { ...r, ...patch } : r),
    }))
  }

  function updateReferralRow(idx: number, patch: Partial<ReferralRow>) {
    setForm(prev => ({
      ...prev,
      referral_rows: prev.referral_rows.map((r, i) => i === idx ? { ...r, ...patch } : r),
    }))
  }

  // Generate invoice
  async function generateInvoice() {
    if (!genTeacher) return
    setGenerating(true)

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
      photocopy_rows: defaults.photocopy_rows,
      reg_fee_rows: defaults.reg_fee_rows,
      referral_rows: defaults.referral_rows,
      overdue_amount: defaults.overdue_amount,
      overdue_description: defaults.overdue_description,
      bank_name: defaults.bank_name,
      bank_account: defaults.bank_account,
      bank_account_name: defaults.bank_account_name,
      remark: defaults.remark,
      payment_status: '',
      payment_date: '',
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
    const regFeeSub = calcRegFeeSubtotal(form)
    const rentalSub = calcRentalSubtotal(form)
    const photoSub = calcPhotocopySubtotal(form)
    const referralSub = calcReferralSubtotal(form)
    const grandTotal = calcGrandTotal(form)
    const issuedDate = formatIssuedDate(activeInvoice.issued_at || activeInvoice.created_at)

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

        {/* Invoice Document */}
        <div className="max-w-[800px] mx-auto invoice-doc bg-white print:bg-white">
          {/* Title */}
          <h1 className="text-center text-lg md:text-xl font-bold mb-6">
            <span className="underline">
              Payment for Tuition Class &ndash;{' '}
              <span className="italic">{formatMonthTitle(activeInvoice.month).split(' ')[0]}</span>
              {' '}{formatMonthTitle(activeInvoice.month).split(' ')[1]}
            </span>
          </h1>

          {/* Main outer table */}
          <table className="w-full border-collapse" style={{ borderSpacing: 0 }}>
            <tbody>
              {/* Teacher's name */}
              <tr>
                <td className={`${tdCls} font-bold w-[160px] align-top`}>Teacher&apos;s name</td>
                <td className={tdCls}>{activeInvoice.teacher?.name || ''}</td>
              </tr>

              {/* Issued date */}
              <tr>
                <td className={`${tdCls} font-bold align-top`}>Issued date</td>
                <td className={tdCls}>{issuedDate}</td>
              </tr>

              {/* Payment Detail — all sub-sections */}
              <tr>
                <td className={`${tdCls} font-bold align-top`}>Payment Detail</td>
                <td className={`${tdCls} space-y-4`}>

                  {/* ===== SECTION 1: Registration and Material Fee ===== */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${thCls} text-left`}>Registration and Material<br />Fee &ndash; yearly (RM)</th>
                        <th className={`${thCls} text-center w-[130px]`}>Number of<br />students</th>
                        <th className={`${thCls} text-center w-[130px]`}>Total Amount<br />(RM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.reg_fee_rows.map((row, idx) => (
                        <tr key={idx}>
                          <td className={tdCls}>
                            <div className="flex items-center gap-1">
                              <div className="flex-1">
                                <span className="hidden print:inline text-sm">
                                  RM{row.fee} per student<br />(Rebate RM{row.rebate} per student)
                                </span>
                                <div className="print:hidden space-y-1">
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-gray-500 whitespace-nowrap">Fee RM</span>
                                    <input type="number" value={row.fee} onChange={e => updateRegFeeRow(idx, { fee: num(e.target.value) })} className={numInputCls + ' w-16'} step="1" />
                                    <span className="text-gray-500 whitespace-nowrap">Rebate RM</span>
                                    <input type="number" value={row.rebate} onChange={e => updateRegFeeRow(idx, { rebate: num(e.target.value) })} className={numInputCls + ' w-16'} step="1" />
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    RM{row.fee} per student (Rebate RM{row.rebate} per student)
                                  </div>
                                </div>
                              </div>
                              {form.reg_fee_rows.length > 1 && (
                                <button type="button" className="print:hidden text-red-400 hover:text-red-600" onClick={() => setForm(prev => ({ ...prev, reg_fee_rows: prev.reg_fee_rows.filter((_, i) => i !== idx) }))}>
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className={`${tdCls} text-center`}>
                            <span className="hidden print:inline">{row.students}</span>
                            <input type="number" value={row.students} onChange={e => updateRegFeeRow(idx, { students: num(e.target.value) })} className={`${numInputCls} w-16 mx-auto print:hidden`} min="0" />
                          </td>
                          <td className={`${tdCls} text-center`}>{calcRegFeeRowSubtotal(row).toFixed(2)}</td>
                        </tr>
                      ))}
                      {/* Add row button */}
                      <tr className="print:hidden">
                        <td colSpan={3} className="border border-black p-1">
                          <button type="button" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-1" onClick={() => setForm(prev => ({ ...prev, reg_fee_rows: [...prev.reg_fee_rows, defaultRegFeeRow()] }))}>
                            <Plus className="h-3 w-3" /> Add Row
                          </button>
                        </td>
                      </tr>
                      {/* Total */}
                      <tr>
                        <td className={`${tdCls} text-center font-bold`} colSpan={2}>Total</td>
                        <td className={`${tdCls} text-center font-bold`}>{regFeeSub.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ===== SECTION 2: Rental Fee - Monthly ===== */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${thCls} text-left`}>Rental Fee - Monthly<br />(RM)</th>
                        <th className={`${thCls} text-center w-[130px]`}>Number of hours</th>
                        <th className={`${thCls} text-center w-[130px]`}>Total Amount<br />(RM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Tier 1: RM22 */}
                      <tr>
                        <td className={tdCls}>
                          <span className="hidden print:inline">RM{form.rental_rate_1} per hour</span>
                          <div className="print:hidden flex items-center gap-1 text-xs">
                            <span className="text-gray-500">RM</span>
                            <input type="number" value={form.rental_rate_1} onChange={e => setField('rental_rate_1', num(e.target.value))} className={numInputCls + ' w-16'} step="1" />
                            <span className="text-gray-500">per hour</span>
                          </div>
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <span className="hidden print:inline">{form.rental_hours_1}</span>
                          <div className="print:hidden flex items-center justify-center gap-1">
                            <span className="text-sm font-medium">{form.rental_hours_1}</span>
                            <span className="text-[10px] text-gray-400">(auto)</span>
                          </div>
                        </td>
                        <td className={`${tdCls} text-center`}>{(form.rental_rate_1 * form.rental_hours_1).toFixed(2)}</td>
                      </tr>
                      {/* Tier 2: RM20 */}
                      <tr>
                        <td className={tdCls}>
                          <span className="hidden print:inline">RM{form.rental_rate_2} per hour</span>
                          <div className="print:hidden flex items-center gap-1 text-xs">
                            <span className="text-gray-500">RM</span>
                            <input type="number" value={form.rental_rate_2} onChange={e => setField('rental_rate_2', num(e.target.value))} className={numInputCls + ' w-16'} step="1" />
                            <span className="text-gray-500">per hour</span>
                          </div>
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <span className="hidden print:inline">{form.rental_hours_2}</span>
                          <input type="number" value={form.rental_hours_2} onChange={e => handleTier2HoursChange(e.target.value)} className={`${numInputCls} w-16 mx-auto print:hidden`} min="0" step="0.5" />
                        </td>
                        <td className={`${tdCls} text-center`}>{(form.rental_rate_2 * form.rental_hours_2).toFixed(2)}</td>
                      </tr>
                      {/* Tier 3: RM12 */}
                      <tr>
                        <td className={tdCls}>
                          <span className="hidden print:inline">RM{form.rental_rate_3} per hour</span>
                          <div className="print:hidden flex items-center gap-1 text-xs">
                            <span className="text-gray-500">RM</span>
                            <input type="number" value={form.rental_rate_3} onChange={e => setField('rental_rate_3', num(e.target.value))} className={numInputCls + ' w-16'} step="1" />
                            <span className="text-gray-500">per hour</span>
                          </div>
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <span className="hidden print:inline">{form.rental_hours_3}</span>
                          <input type="number" value={form.rental_hours_3} onChange={e => handleTier3HoursChange(e.target.value)} className={`${numInputCls} w-16 mx-auto print:hidden`} min="0" step="0.5" />
                        </td>
                        <td className={`${tdCls} text-center`}>{(form.rental_rate_3 * form.rental_hours_3).toFixed(2)}</td>
                      </tr>
                      {/* Total */}
                      <tr>
                        <td className={`${tdCls} text-center font-bold`} colSpan={2}>Total</td>
                        <td className={`${tdCls} text-center font-bold`}>{rentalSub.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* ===== SECTION 3: Photocopy ===== */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${thCls} text-left`}>Photocopy (RM)</th>
                        <th className={`${thCls} text-center w-[160px]`}>
                          Number of copies
                          {form.photocopy_rows.length === 1 && (
                            <>
                              <br />
                              <span className="font-normal text-xs">
                                (Previous Reading: {form.photocopy_rows[0].prev_reading})
                              </span>
                              <br />
                              <span className="font-normal text-xs">
                                (Current Reading: {form.photocopy_rows[0].curr_reading})
                              </span>
                            </>
                          )}
                        </th>
                        <th className={`${thCls} text-center w-[130px]`}>Total Amount<br />(RM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.photocopy_rows.map((row, idx) => {
                        const copies = calcPhotocopyRowCopies(row)
                        const amount = calcPhotocopyRowAmount(row)
                        return (
                          <tr key={idx}>
                            <td className={tdCls}>
                              <div className="flex items-center gap-1">
                                <div className="flex-1">
                                  <span className="hidden print:inline">RM{row.price.toFixed(2)} per copy</span>
                                  <div className="print:hidden flex items-center gap-1 text-xs">
                                    <span className="text-gray-500">RM</span>
                                    <input type="number" value={row.price} onChange={e => updatePhotocopyRow(idx, { price: num(e.target.value) })} className={numInputCls + ' w-16'} step="0.01" />
                                    <span className="text-gray-500">per copy</span>
                                  </div>
                                </div>
                                {form.photocopy_rows.length > 1 && (
                                  <button type="button" className="print:hidden text-red-400 hover:text-red-600" onClick={() => setForm(prev => ({ ...prev, photocopy_rows: prev.photocopy_rows.filter((_, i) => i !== idx) }))}>
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className={`${tdCls} text-center`}>
                              <span className="hidden print:inline">{copies}</span>
                              <div className="print:hidden space-y-1">
                                <div className="flex items-center gap-1 text-xs justify-center">
                                  <span className="text-gray-500">Prev</span>
                                  <input type="number" value={row.prev_reading} onChange={e => updatePhotocopyRow(idx, { prev_reading: num(e.target.value) })} className={numInputCls + ' w-20'} />
                                </div>
                                <div className="flex items-center gap-1 text-xs justify-center">
                                  <span className="text-gray-500">Curr</span>
                                  <input type="number" value={row.curr_reading} onChange={e => updatePhotocopyRow(idx, { curr_reading: num(e.target.value) })} className={numInputCls + ' w-20'} />
                                </div>
                                <div className="text-xs text-gray-400">= {copies} copies</div>
                              </div>
                              {form.photocopy_rows.length > 1 && (
                                <div className="hidden print:block text-xs text-gray-500 mt-0.5">
                                  (Prev: {row.prev_reading}, Curr: {row.curr_reading})
                                </div>
                              )}
                            </td>
                            <td className={`${tdCls} text-center`}>{amount.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                      {/* Add row button */}
                      <tr className="print:hidden">
                        <td colSpan={3} className="border border-black p-1">
                          <button type="button" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-1" onClick={() => setForm(prev => ({ ...prev, photocopy_rows: [...prev.photocopy_rows, defaultPhotocopyRow()] }))}>
                            <Plus className="h-3 w-3" /> Add Row
                          </button>
                        </td>
                      </tr>
                      {/* Total (only shown if more than one row or if there's a total to show) */}
                      {form.photocopy_rows.length > 1 && (
                        <tr>
                          <td className={`${tdCls} text-center font-bold`} colSpan={2}>Total</td>
                          <td className={`${tdCls} text-center font-bold`}>{photoSub.toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* ===== SECTION 4: Chargeable monthly fee for student referral ===== */}
                  {(form.referral_rows.length > 0 || true) && (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${thCls} text-left`}>Chargeable monthly<br />fee for student referral</th>
                          <th className={`${thCls} text-center w-[130px]`}>Percentage (%)</th>
                          <th className={`${thCls} text-center w-[130px]`}>Referral Fee (RM)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.referral_rows.map((row, idx) => {
                          const fee = calcReferralRowFee(row)
                          return (
                            <tr key={idx}>
                              <td className={tdCls}>
                                <div className="flex items-center gap-1">
                                  <div className="flex-1">
                                    <span className="hidden print:inline">RM{row.amount}</span>
                                    <div className="print:hidden flex items-center gap-1 text-xs">
                                      <span className="text-gray-500">RM</span>
                                      <input type="number" value={row.amount} onChange={e => {
                                        const amt = num(e.target.value)
                                        updateReferralRow(idx, { amount: amt, description: `RM${amt}` })
                                      }} className={numInputCls + ' w-20'} step="1" />
                                      <input type="text" value={row.description} onChange={e => updateReferralRow(idx, { description: e.target.value })} className={inputCls + ' w-24 text-xs text-gray-400'} placeholder="label" />
                                    </div>
                                  </div>
                                  <button type="button" className="print:hidden text-red-400 hover:text-red-600" onClick={() => setForm(prev => ({ ...prev, referral_rows: prev.referral_rows.filter((_, i) => i !== idx) }))}>
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                              <td className={`${tdCls} text-center`}>
                                <span className="hidden print:inline">{row.percentage}</span>
                                <input type="number" value={row.percentage} onChange={e => updateReferralRow(idx, { percentage: num(e.target.value) })} className={`${numInputCls} w-16 mx-auto print:hidden`} step="1" />
                              </td>
                              <td className={`${tdCls} text-center`}>{fee.toFixed(2)}</td>
                            </tr>
                          )
                        })}
                        {form.referral_rows.length === 0 && (
                          <tr className="print:hidden">
                            <td colSpan={3} className={`${tdCls} text-center text-gray-400 text-xs`}>
                              No referral rows. Click &quot;Add Row&quot; to add one.
                            </td>
                          </tr>
                        )}
                        {/* Add row button */}
                        <tr className="print:hidden">
                          <td colSpan={3} className="border border-black p-1">
                            <button type="button" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-1" onClick={() => setForm(prev => ({ ...prev, referral_rows: [...prev.referral_rows, defaultReferralRow()] }))}>
                              <Plus className="h-3 w-3" /> Add Row
                            </button>
                          </td>
                        </tr>
                        {form.referral_rows.length > 1 && (
                          <tr>
                            <td className={`${tdCls} text-center font-bold`} colSpan={2}>Total</td>
                            <td className={`${tdCls} text-center font-bold`}>{referralSub.toFixed(2)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}

                  {/* ===== SECTION 5: Other Fees ===== */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`${thCls} text-center`} colSpan={2}>Other Fees</th>
                        <th className={`${thCls} text-center w-[130px]`}>Total Amount (RM)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={tdCls} colSpan={2}>
                          <span className="hidden print:inline">Overdue Fee</span>
                          <div className="print:hidden flex items-center gap-2 text-xs">
                            <span className="text-gray-600">Overdue Fee</span>
                            <input type="text" value={form.overdue_description} onChange={e => setField('overdue_description', e.target.value)} className={inputCls + ' flex-1 text-gray-400'} placeholder="description (optional)" />
                          </div>
                        </td>
                        <td className={`${tdCls} text-center`}>
                          <span className="hidden print:inline">{form.overdue_amount.toFixed(2)}</span>
                          <input type="number" value={form.overdue_amount} onChange={e => setField('overdue_amount', num(e.target.value))} className={`${numInputCls} w-24 mx-auto print:hidden`} step="0.01" min="0" />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                </td>
              </tr>

              {/* ===== SECTION 6: Total payment ===== */}
              <tr className="bg-yellow-50 print:bg-yellow-50">
                <td className={`${tdCls} font-bold`}>Total payment</td>
                <td className={`${tdCls} font-bold text-base`}>RM{grandTotal.toFixed(2)}</td>
              </tr>

              {/* ===== SECTION 7: Payment Method + Remark ===== */}
              <tr>
                <td className={`${tdCls} font-bold align-top`}>Payment Method</td>
                <td className={tdCls}>
                  <div className="mb-3">
                    <span className="hidden print:block">
                      Online Transfer:<br />
                      <span className="italic font-bold ml-4">{form.bank_account_name}</span><br />
                      <span className="italic font-bold ml-4">{form.bank_name}</span><br />
                      <span className="italic font-bold ml-4">{form.bank_account}</span>
                    </span>
                    <div className="print:hidden space-y-1.5">
                      <div className="text-sm">Online Transfer:</div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500 w-20">Name</span>
                        <input type="text" value={form.bank_account_name} onChange={e => setField('bank_account_name', e.target.value)} className={inputCls} />
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500 w-20">Bank</span>
                        <input type="text" value={form.bank_name} onChange={e => setField('bank_name', e.target.value)} className={inputCls} />
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500 w-20">Account</span>
                        <input type="text" value={form.bank_account} onChange={e => setField('bank_account', e.target.value)} className={inputCls} />
                      </div>
                    </div>
                  </div>
                  {/* Remark */}
                  <div>
                    <span className="hidden print:block">
                      <span className="underline font-bold">Remark:</span><br />
                      <span className="font-bold">{form.remark}</span>
                    </span>
                    <div className="print:hidden space-y-1">
                      <label className="text-xs text-gray-500 font-medium underline">Remark:</label>
                      <textarea
                        value={form.remark}
                        onChange={e => setField('remark', e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[60px]"
                        rows={3}
                      />
                    </div>
                  </div>
                </td>
              </tr>

              {/* ===== SECTION 8/9: Status and Date of payment ===== */}
              <tr>
                <td className={`${tdCls} font-bold`}>Status of payment</td>
                <td className={tdCls}>
                  <span className="hidden print:inline">{form.payment_status}</span>
                  <input type="text" value={form.payment_status} onChange={e => setField('payment_status', e.target.value)} className={`${inputCls} print:hidden`} placeholder="e.g. Paid, Pending..." />
                </td>
              </tr>
              <tr>
                <td className={`${tdCls} font-bold`}>Date of payment</td>
                <td className={tdCls}>
                  <span className="hidden print:inline">{form.payment_date}</span>
                  <input type="text" value={form.payment_date} onChange={e => setField('payment_date', e.target.value)} className={`${inputCls} print:hidden`} placeholder="e.g. 10th April 2026" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action buttons (screen only) */}
        <div className="flex flex-wrap items-center gap-2 mt-4 print:hidden max-w-[800px] mx-auto">
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
