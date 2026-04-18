'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Schedule, Teacher, Room, ScheduleException, ClassType } from '@/lib/types'
import { DAYS, TIME_SLOTS } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SUBJECTS, CLASS_TYPES } from '@/lib/types'
import { Plus, Ban, RefreshCw } from 'lucide-react'

const TEACHER_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-red-100 text-red-800 border-red-200',
]

const CLASS_TYPE_STYLES: Record<string, string> = {
  '1-to-1': 'bg-purple-100 text-purple-700',
  'small_group': 'bg-blue-100 text-blue-700',
  'large_group': 'bg-green-100 text-green-700',
}

const CLASS_TYPE_LABELS: Record<string, string> = {
  '1-to-1': '1:1',
  'small_group': 'Small',
  'large_group': 'Large',
}

function getWeekDates(baseDate: Date) {
  const day = baseDate.getDay()
  const sun = new Date(baseDate)
  sun.setDate(baseDate.getDate() - day)
  return DAYS.map((_, i) => {
    const d = new Date(sun)
    d.setDate(sun.getDate() + i)
    return d
  })
}

function fmtDate(d: Date) {
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TimetablePage() {
  const [schedules, setSchedules] = useState<(Schedule & { teacher?: Teacher; room?: Room })[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [exceptions, setExceptions] = useState<ScheduleException[]>([])
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [loading, setLoading] = useState(true)
  const [weekBase, setWeekBase] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const weekDates = getWeekDates(weekBase)
  const selectedDateStr = toDateStr(weekDates[selectedDay])

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Exception dialog
  const [exDialog, setExDialog] = useState(false)
  const [exSchedule, setExSchedule] = useState<(Schedule & { teacher?: Teacher; room?: Room }) | null>(null)
  const [exAction, setExAction] = useState<'cancel' | 'replace'>('cancel')
  const [exDate, setExDate] = useState('')
  const [replDate, setReplDate] = useState('')
  const [replStart, setReplStart] = useState('14:00')
  const [replEnd, setReplEnd] = useState('16:00')
  const [replRoom, setReplRoom] = useState('')
  const [exSaving, setExSaving] = useState(false)
  const [exExisting, setExExisting] = useState<ScheduleException | null>(null)

  const [form, setForm] = useState({
    teacher_id: '', room_id: '', subject: SUBJECTS[0], exam_system: 'SPM',
    day_of_week: 1, start_time: '14:00', end_time: '16:00', class_type: 'large_group',
    effective_from: new Date().toISOString().split('T')[0],
  })
  const supabase = createClient()

  const teacherColorMap = new Map<string, string>()
  teachers.forEach((t, i) => teacherColorMap.set(t.id, TEACHER_COLORS[i % TEACHER_COLORS.length]))

  const load = useCallback(async () => {
    // Get week date range for exceptions query
    const weekStart = toDateStr(getWeekDates(weekBase)[0])
    const weekEnd = toDateStr(getWeekDates(weekBase)[6])

    const [schedulesRes, roomsRes, teachersRes, exRes, ctRes] = await Promise.all([
      supabase.from('schedules').select('*, teacher:teachers(*), room:rooms(*)').eq('status', 'active'),
      supabase.from('rooms').select('*').eq('status', 'active').order('name'),
      supabase.from('teachers').select('*').eq('status', 'active').order('name'),
      supabase.from('schedule_exceptions').select('*')
        .or(`date.gte.${weekStart},replacement_date.gte.${weekStart}`)
        .or(`date.lte.${weekEnd},replacement_date.lte.${weekEnd}`),
      supabase.from('class_types').select('*').eq('status', 'active').order('name'),
    ])
    setSchedules(schedulesRes.data || [])
    setRooms(roomsRes.data || [])
    setTeachers(teachersRes.data || [])
    setExceptions(exRes.data || [])
    setClassTypes(ctRes.data || [])
    setLoading(false)
  }, [supabase, weekBase])

  useEffect(() => { load() }, [load])

  // Check if a schedule is cancelled on a specific date
  function isCancelled(scheduleId: string, dateStr: string): ScheduleException | undefined {
    return exceptions.find(e =>
      e.schedule_id === scheduleId &&
      e.date === dateStr &&
      (e.type === 'cancelled' || e.type === 'replacement')
    )
  }

  // Get replacement classes showing on a specific date
  function getReplacements(dateStr: string) {
    return exceptions.filter(e =>
      e.type === 'replacement' &&
      e.replacement_date === dateStr
    )
  }

  function getSlotSchedules(roomId: string, time: string) {
    const regular = schedules.filter(s => {
      if (s.room_id !== roomId || s.day_of_week !== selectedDay) return false
      if (s.start_time <= time && s.end_time > time) return true
      return false
    })

    return regular
  }

  // Get replacement classes for this room+time on selected date
  function getSlotReplacements(roomId: string, time: string) {
    return getReplacements(selectedDateStr).filter(e => {
      if (e.replacement_room_id !== roomId) return false
      const start = e.replacement_start_time || ''
      const end = e.replacement_end_time || ''
      return start <= time && end > time
    })
  }

  function openCreate(roomId?: string, time?: string) {
    setEditSchedule(null)
    setDeleteConfirm(false)
    setForm({
      teacher_id: teachers[0]?.id || '', room_id: roomId || rooms[0]?.id || '',
      subject: SUBJECTS[0], exam_system: 'SPM',
      day_of_week: selectedDay, start_time: time || '14:00', end_time: time ? `${parseInt(time) + 2}:00` : '16:00',
      class_type: 'large_group', effective_from: new Date().toISOString().split('T')[0],
    })
    setDialogOpen(true)
  }

  function openEdit(s: Schedule) {
    setEditSchedule(s)
    setDeleteConfirm(false)
    setForm({
      teacher_id: s.teacher_id, room_id: s.room_id, subject: s.subject,
      exam_system: s.exam_system, day_of_week: s.day_of_week,
      start_time: s.start_time, end_time: s.end_time, class_type: s.class_type,
      effective_from: s.effective_from,
    })
    setDialogOpen(true)
  }

  // Open exception dialog for cancel/replace on specific date
  function openException(s: Schedule & { teacher?: Teacher; room?: Room }) {
    const existing = isCancelled(s.id, selectedDateStr)
    setExSchedule(s)
    setExDate(selectedDateStr)
    setExExisting(existing || null)
    if (existing?.type === 'replacement') {
      setExAction('replace')
      setReplDate(existing.replacement_date || '')
      setReplStart(existing.replacement_start_time || s.start_time)
      setReplEnd(existing.replacement_end_time || s.end_time)
      setReplRoom(existing.replacement_room_id || s.room_id)
    } else if (existing?.type === 'cancelled') {
      setExAction('cancel')
      setReplDate('')
      setReplStart(s.start_time)
      setReplEnd(s.end_time)
      setReplRoom(s.room_id)
    } else {
      setExAction('cancel')
      setReplDate('')
      setReplStart(s.start_time)
      setReplEnd(s.end_time)
      setReplRoom(s.room_id)
    }
    setExDialog(true)
  }

  async function handleSaveException() {
    if (!exSchedule) return
    setExSaving(true)

    const record: Record<string, unknown> = {
      schedule_id: exSchedule.id,
      date: exDate,
      type: exAction === 'replace' ? 'replacement' : exAction,
      title: exAction === 'cancel'
        ? `${exSchedule.subject} cancelled`
        : `${exSchedule.subject} moved to ${replDate}`,
      affects: 'specific',
      notes: null,
      replacement_date: exAction === 'replace' ? replDate : null,
      replacement_start_time: exAction === 'replace' ? replStart : null,
      replacement_end_time: exAction === 'replace' ? replEnd : null,
      replacement_room_id: exAction === 'replace' ? replRoom : null,
    }

    if (exExisting) {
      const { error } = await supabase.from('schedule_exceptions').update(record).eq('id', exExisting.id)
      if (error) { alert(`Error: ${error.message}`); setExSaving(false); return }
    } else {
      const { error } = await supabase.from('schedule_exceptions').insert(record)
      if (error) { alert(`Error: ${error.message}`); setExSaving(false); return }
    }

    setExSaving(false)
    setExDialog(false)
    load()
  }

  async function handleRemoveException() {
    if (!exExisting) return
    setExSaving(true)
    await supabase.from('schedule_exceptions').delete().eq('id', exExisting.id)
    setExSaving(false)
    setExDialog(false)
    load()
  }

  async function handleSave() {
    if (!form.teacher_id) { alert('Please add a teacher first.'); return }
    if (!form.room_id) { alert('Please add a room first.'); return }
    if (!form.start_time || !form.end_time) { alert('Please set both start and end time.'); return }
    if (form.start_time >= form.end_time) { alert('End time must be after start time.'); return }

    setSaving(true)
    const conflicts = schedules.filter(s =>
      s.room_id === form.room_id && s.day_of_week === form.day_of_week &&
      s.start_time < form.end_time && s.end_time > form.start_time &&
      s.id !== editSchedule?.id
    )
    if (conflicts.length > 0) {
      alert(`Room conflict! ${conflicts[0].teacher?.name || 'Another teacher'} already has this room.`)
      setSaving(false)
      return
    }

    if (editSchedule) {
      const { error } = await supabase.from('schedules').update(form).eq('id', editSchedule.id)
      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }
    } else {
      const { error } = await supabase.from('schedules').insert(form)
      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }
    }
    setSaving(false)
    setDialogOpen(false)
    load()
  }

  async function handleDelete() {
    if (!editSchedule) return
    setDeleting(true)
    await supabase.from('schedules').update({ status: 'cancelled' }).eq('id', editSchedule.id)
    setDeleting(false)
    setDeleteConfirm(false)
    setDialogOpen(false)
    load()
  }

  const displayTimes = TIME_SLOTS.filter(t => parseInt(t) >= 8 && parseInt(t) <= 20)

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Timetable</h1>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => openCreate()}>
          <Plus className="h-4 w-4 mr-1" /> Add Class
        </Button>
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() - 7); setWeekBase(d) }}
          className="px-2 py-1 rounded border text-gray-500 hover:bg-gray-50 text-lg font-bold">‹</button>
        <span className="text-sm font-medium text-gray-600">
          {fmtDate(weekDates[0])} — {fmtDate(weekDates[6])}
        </span>
        <button onClick={() => { const d = new Date(weekBase); d.setDate(d.getDate() + 7); setWeekBase(d) }}
          className="px-2 py-1 rounded border text-gray-500 hover:bg-gray-50 text-lg font-bold">›</button>
        <button onClick={() => { setWeekBase(new Date()); setSelectedDay(new Date().getDay()) }}
          className="px-2 py-1 rounded border text-xs text-blue-600 hover:bg-blue-50 ml-1">Today</button>
      </div>

      {/* Day selector */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {DAYS.map((day, i) => {
          const isToday = weekDates[i].toDateString() === new Date().toDateString()
          return (
            <button key={day} onClick={() => setSelectedDay(i)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex flex-col items-center min-w-[70px] ${
                selectedDay === i ? 'bg-blue-600 text-white'
                  : isToday ? 'bg-blue-50 text-blue-600 border-2 border-blue-300'
                    : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}>
              <span className="text-xs">{day.slice(0, 3)}</span>
              <span className="text-base font-bold">{fmtDate(weekDates[i])}</span>
            </button>
          )
        })}
      </div>

      {/* Teacher legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {teachers.map(t => (
          <span key={t.id} className={`px-2 py-0.5 rounded text-xs font-medium border ${teacherColorMap.get(t.id)}`}>
            {t.name}
          </span>
        ))}
      </div>

      {/* Grid */}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left font-medium sticky left-0 bg-white min-w-[100px]">Room</th>
                {displayTimes.map(time => (
                  <th key={time} className="p-2 text-center font-medium min-w-[100px]">{time}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => (
                <tr key={room.id} className="border-b">
                  <td className="p-2 font-medium sticky left-0 bg-white">{room.name}</td>
                  {displayTimes.map(time => {
                    const slotSchedules = getSlotSchedules(room.id, time)
                    const slotReplacements = getSlotReplacements(room.id, time)

                    return (
                      <td key={time} className="p-1 min-w-[100px]">
                        {/* Regular classes */}
                        {slotSchedules.map(s => {
                          const ex = isCancelled(s.id, selectedDateStr)
                          const cancelled = !!ex
                          return (
                            <div key={s.id}
                              className={`px-1.5 py-1 rounded text-xs border cursor-pointer relative ${
                                cancelled
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 line-through opacity-60'
                                  : teacherColorMap.get(s.teacher_id) || 'bg-gray-100'
                              }`}
                              onClick={() => openException(s)}
                            >
                              <div className="font-medium truncate">{s.teacher?.name}</div>
                              <div className="truncate">{s.subject}</div>
                              <span className={`inline-block mt-0.5 px-1 py-0 rounded text-[9px] font-medium ${cancelled ? 'bg-gray-200 text-gray-500' : CLASS_TYPE_STYLES[s.class_type] || 'bg-gray-100'}`}>
                                {cancelled ? (ex?.type === 'replacement' ? '🔄 Moved' : '❌ Off') : CLASS_TYPE_LABELS[s.class_type] || s.class_type}
                              </span>
                            </div>
                          )
                        })}

                        {/* Replacement classes showing on this date */}
                        {slotReplacements.map(ex => {
                          const origSchedule = schedules.find(s => s.id === ex.schedule_id)
                          if (!origSchedule) return null
                          return (
                            <div key={ex.id}
                              className={`px-1.5 py-1 rounded text-xs border-2 border-dashed cursor-pointer ${
                                teacherColorMap.get(origSchedule.teacher_id) || 'bg-gray-100'
                              } border-orange-400`}
                              onClick={() => {
                                // Navigate to original date to edit
                                setExSchedule(origSchedule)
                                setExDate(ex.date)
                                setExExisting(ex)
                                setExAction('replace')
                                setReplDate(ex.replacement_date || '')
                                setReplStart(ex.replacement_start_time || origSchedule.start_time)
                                setReplEnd(ex.replacement_end_time || origSchedule.end_time)
                                setReplRoom(ex.replacement_room_id || origSchedule.room_id)
                                setExDialog(true)
                              }}
                            >
                              <div className="font-medium truncate">{origSchedule.teacher?.name}</div>
                              <div className="truncate">{origSchedule.subject}</div>
                              <span className="inline-block mt-0.5 px-1 py-0 rounded text-[9px] font-medium bg-orange-100 text-orange-700">
                                🔄 Replacement
                              </span>
                            </div>
                          )
                        })}

                        {/* Empty slot click */}
                        {slotSchedules.length === 0 && slotReplacements.length === 0 && (
                          <div className="h-8 cursor-pointer hover:bg-gray-50 rounded"
                            onClick={() => openCreate(room.id, time)} />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Cancel/Replace Dialog */}
      <Dialog open={exDialog} onOpenChange={setExDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {exSchedule?.subject} — {exDate}
            </DialogTitle>
          </DialogHeader>
          {exSchedule && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {exSchedule.teacher?.name} · {exSchedule.start_time}–{exSchedule.end_time} · {exSchedule.room?.name}
                </div>
                <button
                  onClick={() => { setExDialog(false); openEdit(exSchedule) }}
                  className="text-[11px] text-blue-500 hover:underline"
                >Edit recurring</button>
              </div>

              {/* Action selector */}
              <div className="flex gap-2">
                <Button
                  variant={exAction === 'cancel' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExAction('cancel')}
                  className={exAction === 'cancel' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  <Ban className="h-3 w-3 mr-1" /> Cancel Class
                </Button>
                <Button
                  variant={exAction === 'replace' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExAction('replace')}
                  className={exAction === 'replace' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Replace Class
                </Button>
              </div>

              {exAction === 'replace' && (
                <div className="space-y-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-xs font-medium text-orange-700">Move this class to:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">New Date</Label>
                      <Input type="date" value={replDate} onChange={e => setReplDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Room</Label>
                      <select value={replRoom} onChange={e => setReplRoom(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm">
                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start Time</Label>
                      <Input type="time" value={replStart} onChange={e => setReplStart(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Time</Label>
                      <Input type="time" value={replEnd} onChange={e => setReplEnd(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {exAction === 'cancel' && (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700">This class on <strong>{exDate}</strong> will be marked as cancelled. It will appear greyed out on the timetable and removed from attendance.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {exExisting && (
              <Button variant="outline" onClick={handleRemoveException} disabled={exSaving} className="mr-auto text-xs">
                Restore Original
              </Button>
            )}
            <Button variant="outline" onClick={() => setExDialog(false)}>Cancel</Button>
            <Button
              className={exAction === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}
              onClick={handleSaveException}
              disabled={exSaving || (exAction === 'replace' && !replDate)}
            >
              {exSaving ? 'Saving...' : exAction === 'cancel' ? 'Cancel Class' : 'Move Class'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Schedule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editSchedule ? 'Edit Class Schedule' : 'Add Class Schedule'}</DialogTitle>
          </DialogHeader>

          {(teachers.length === 0 || rooms.length === 0) && !editSchedule && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              {teachers.length === 0 && <p>⚠️ No teachers yet. Please add teachers first.</p>}
              {rooms.length === 0 && <p>⚠️ No rooms yet. Please add rooms first.</p>}
            </div>
          )}

          {deleteConfirm ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Are you sure you want to permanently cancel this recurring class?</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Go Back</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Cancelling...' : 'Yes, Cancel Forever'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Teacher</Label>
                    <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Room</Label>
                    <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                      {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Class</Label>
                    <select
                      value={classTypes.find(ct => ct.name === form.subject && ct.exam_system === form.exam_system)?.id || ''}
                      onChange={e => {
                        const ct = classTypes.find(c => c.id === e.target.value)
                        if (ct) setForm(f => ({ ...f, subject: ct.name, exam_system: ct.exam_system }))
                      }}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    >
                      <option value="">Select class</option>
                      {classTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Day</Label>
                    <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                      {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Class Type</Label>
                    <select value={form.class_type} onChange={e => setForm(f => ({ ...f, class_type: e.target.value }))} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm">
                      {CLASS_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Start Time</Label>
                    <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>End Time</Label>
                    <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Effective From</Label>
                  <Input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                {editSchedule && (
                  <Button variant="destructive" onClick={() => setDeleteConfirm(true)} className="mr-auto">
                    Cancel Forever
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Close</Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
