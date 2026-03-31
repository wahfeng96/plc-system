'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Room } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DoorOpen } from 'lucide-react'

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [form, setForm] = useState({ name: '', hourly_rate: 22, status: 'active' as 'active' | 'inactive' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const load = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').order('name')
    setRooms(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function openEdit(r: Room) {
    setEditing(r)
    setForm({ name: r.name, hourly_rate: r.hourly_rate, status: r.status })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    await supabase.from('rooms').update({
      hourly_rate: form.hourly_rate,
      status: form.status,
    }).eq('id', editing.id)
    setSaving(false)
    setDialogOpen(false)
    load()
  }

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Rooms</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {rooms.map(room => (
          <Card key={room.id} className="cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all" onClick={() => openEdit(room)}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${room.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{room.name}</p>
                  <p className="text-sm text-gray-500">RM{room.hourly_rate}/hr</p>
                </div>
              </div>
              <Badge variant={room.status === 'active' ? 'default' : 'secondary'} className="mt-2">
                {room.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Hourly Rate (RM)</Label>
              <Input
                type="number"
                value={form.hourly_rate}
                onChange={e => setForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
