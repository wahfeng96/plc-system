'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { ClassSession, Room, Invoice } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Receipt, DollarSign, Calendar } from 'lucide-react'

export default function MyRentalPage() {
  const { teacher } = useAuth()
  const [sessions, setSessions] = useState<(ClassSession & { room?: Room; schedule?: { subject: string } })[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const supabase = createClient()

  const load = useCallback(async () => {
    if (!teacher) { setLoading(false); return }
    setLoading(true)
    const [sessionsRes, invoicesRes] = await Promise.all([
      supabase
        .from('class_sessions')
        .select('*, room:rooms(*), schedule:schedules(subject)')
        .eq('teacher_id', teacher.id)
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`)
        .neq('status', 'cancelled')
        .order('date'),
      supabase
        .from('invoices')
        .select('*')
        .eq('teacher_id', teacher.id)
        .eq('month', month),
    ])
    setSessions(sessionsRes.data || [])
    setInvoices(invoicesRes.data || [])
    setLoading(false)
  }, [supabase, teacher, month])

  useEffect(() => { load() }, [load])

  if (!teacher) return <div className="text-center py-12 text-gray-500">No teacher profile linked</div>
  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  const totalRental = sessions.reduce((sum, s) => sum + (s.rental_amount || 0), 0)
  const totalHours = sessions.reduce((sum, s) => sum + (s.hours || 0), 0)
  const invoice = invoices[0]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Rental</h1>

      <div className="mb-4">
        <Label className="text-xs text-gray-500">Month</Label>
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sessions</p>
                <p className="text-xl font-bold">{sessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Receipt className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Hours</p>
                <p className="text-xl font-bold">{totalHours}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Rental Amount</p>
                <p className="text-xl font-bold">RM {totalRental.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {invoice && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Invoice ({invoice.month})</span>
              <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>{invoice.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Room Rental</p>
                <p className="font-semibold">RM {invoice.room_rental_total.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Commission</p>
                <p className="font-semibold">RM {invoice.commission_total.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Grand Total</p>
                <p className="font-bold text-blue-600">RM {invoice.grand_total.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.date}</TableCell>
                  <TableCell>{s.schedule?.subject}</TableCell>
                  <TableCell>{s.room?.name}</TableCell>
                  <TableCell>{s.hours}</TableCell>
                  <TableCell>RM {s.rental_amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    No sessions for this month
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
