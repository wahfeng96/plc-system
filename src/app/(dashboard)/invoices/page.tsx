'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Teacher, Invoice, InvoiceItem } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FileText, Plus, Eye, Printer } from 'lucide-react'

export default function InvoicesPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [invoices, setInvoices] = useState<(Invoice & { teacher?: Teacher })[]>([])
  const [loading, setLoading] = useState(true)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<(Invoice & { teacher?: Teacher }) | null>(null)
  const [detailItems, setDetailItems] = useState<InvoiceItem[]>([])
  const [genMonth, setGenMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [genTeacher, setGenTeacher] = useState('')
  const [generating, setGenerating] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    const [teachersRes, invoicesRes] = await Promise.all([
      supabase.from('teachers').select('*').eq('status', 'active').order('name'),
      supabase.from('invoices').select('*, teacher:teachers(*)').order('created_at', { ascending: false }),
    ])
    setTeachers(teachersRes.data || [])
    setInvoices(invoicesRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function generateInvoice() {
    if (!genTeacher) return
    setGenerating(true)

    const teacher = teachers.find(t => t.id === genTeacher)
    if (!teacher) { setGenerating(false); return }

    // Get class sessions for this teacher in the given month
    const { data: sessions } = await supabase
      .from('class_sessions')
      .select('*, schedule:schedules(subject), room:rooms(name)')
      .eq('teacher_id', genTeacher)
      .gte('date', `${genMonth}-01`)
      .lte('date', `${genMonth}-31`)
      .neq('status', 'cancelled')

    const rentalTotal = (sessions || []).reduce((sum, s) => sum + (s.rental_amount || 0), 0)

    // Get commission: 10% of tuition for admin-registered students
    const { data: studentSubs } = await supabase
      .from('student_subjects')
      .select('*, student:students(name)')
      .eq('teacher_id', genTeacher)
      .eq('registered_by_admin', true)
      .eq('status', 'active')

    const commissionTotal = (studentSubs || []).reduce((sum, ss) => sum + (ss.tuition_fee * 0.1), 0)
    const grandTotal = rentalTotal + commissionTotal

    // Create invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .upsert({
        teacher_id: genTeacher,
        month: genMonth,
        room_rental_total: rentalTotal,
        commission_total: commissionTotal,
        grand_total: grandTotal,
        status: 'draft',
      }, { onConflict: 'teacher_id,month' })
      .select()
      .single()

    if (invoice) {
      // Delete old items and insert new ones
      await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id)

      const items: Omit<InvoiceItem, 'id'>[] = []

      // Rental items
      for (const s of sessions || []) {
        items.push({
          invoice_id: invoice.id,
          type: 'rental',
          description: `${s.date} - ${s.schedule?.subject || 'Class'} (${s.room?.name || 'Room'})`,
          amount: s.rental_amount || 0,
          class_session_id: s.id,
          student_subject_id: null,
        })
      }

      // Commission items
      for (const ss of studentSubs || []) {
        items.push({
          invoice_id: invoice.id,
          type: 'commission',
          description: `${ss.student?.name || 'Student'} - ${ss.subject} (10% of RM${ss.tuition_fee})`,
          amount: ss.tuition_fee * 0.1,
          class_session_id: null,
          student_subject_id: ss.id,
        })
      }

      if (items.length > 0) {
        await supabase.from('invoice_items').insert(items)
      }
    }

    setGenerating(false)
    setGenerateOpen(false)
    load()
  }

  async function viewDetail(inv: Invoice & { teacher?: Teacher }) {
    setDetailInvoice(inv)
    const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('type')
    setDetailItems(data || [])
  }

  async function updateStatus(id: string, status: 'issued' | 'paid') {
    const updates: Record<string, unknown> = { status }
    if (status === 'issued') updates.issued_at = new Date().toISOString()
    if (status === 'paid') updates.paid_at = new Date().toISOString()
    await supabase.from('invoices').update(updates).eq('id', id)
    setDetailInvoice(null)
    load()
  }

  function printInvoice() {
    window.print()
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    issued: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setGenerateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Generate Invoice
        </Button>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Rental</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.month}</TableCell>
                  <TableCell>{inv.teacher?.name}</TableCell>
                  <TableCell>RM {inv.room_rental_total.toFixed(2)}</TableCell>
                  <TableCell>RM {inv.commission_total.toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">RM {inv.grand_total.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status]}`}>
                      {inv.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" onClick={() => viewDetail(inv)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    No invoices generated yet
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
            <DialogTitle>Generate Monthly Invoice</DialogTitle>
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
              This will calculate room rental (sessions × rate) + commission (10% of tuition for admin-registered students).
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

      {/* Invoice Detail Dialog */}
      <Dialog open={!!detailInvoice} onOpenChange={() => setDetailInvoice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none">
          <DialogHeader>
            <DialogTitle>
              Invoice — {detailInvoice?.teacher?.name} ({detailInvoice?.month})
            </DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500">Room Rental</div>
                  <div className="text-lg font-bold">RM {detailInvoice.room_rental_total.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-500">Commission</div>
                  <div className="text-lg font-bold">RM {detailInvoice.commission_total.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-blue-600">Grand Total</div>
                  <div className="text-lg font-bold text-blue-700">RM {detailInvoice.grand_total.toFixed(2)}</div>
                </div>
              </div>

              {detailItems.filter(i => i.type === 'rental').length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Room Rental</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailItems.filter(i => i.type === 'rental').map(item => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">RM {item.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {detailItems.filter(i => i.type === 'commission').length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Commission (10%)</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailItems.filter(i => i.type === 'commission').map(item => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">RM {item.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={printInvoice}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
            {detailInvoice?.status === 'draft' && (
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => updateStatus(detailInvoice.id, 'issued')}>
                Mark as Issued
              </Button>
            )}
            {detailInvoice?.status === 'issued' && (
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus(detailInvoice.id, 'paid')}>
                Mark as Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
