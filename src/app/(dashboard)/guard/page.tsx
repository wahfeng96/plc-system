'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Schedule, Teacher, Room } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DoorOpen, Clock, User } from 'lucide-react'

export default function GuardPage() {
  const [schedules, setSchedules] = useState<(Schedule & { teacher?: Teacher; room?: Room })[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const today = new Date()
  const dayOfWeek = today.getDay()

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*, teacher:teachers(*), room:rooms(*)')
      .eq('day_of_week', dayOfWeek)
      .eq('status', 'active')
      .order('start_time')
    setSchedules(data || [])
    setLoading(false)
  }, [supabase, dayOfWeek])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  // Group by room
  const byRoom = new Map<string, typeof schedules>()
  for (const s of schedules) {
    const roomName = s.room?.name || 'Unknown'
    if (!byRoom.has(roomName)) byRoom.set(roomName, [])
    byRoom.get(roomName)!.push(s)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Today&apos;s Schedule</h1>
      <p className="text-sm text-gray-500 mb-6">
        {today.toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <DoorOpen className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No classes scheduled today
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(byRoom.entries()).map(([roomName, roomSchedules]) => (
            <Card key={roomName}>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <DoorOpen className="h-5 w-5 text-blue-600" />
                  <h2 className="font-bold text-lg">{roomName}</h2>
                </div>
                <div className="space-y-2">
                  {roomSchedules.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-sm">
                          <div className="flex items-center gap-1 font-medium">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            {s.start_time} — {s.end_time}
                          </div>
                          <div className="flex items-center gap-1 text-gray-500 mt-0.5">
                            <User className="h-3.5 w-3.5" />
                            {s.teacher?.name}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">{s.subject}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
