'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import type { Schedule, Room } from '@/lib/types'
import { DAYS } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin } from 'lucide-react'

export default function MySchedulePage() {
  const { teacher } = useAuth()
  const [schedules, setSchedules] = useState<(Schedule & { room?: Room })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const supabase = createClient()

  const load = useCallback(async () => {
    if (!teacher) { setLoading(false); return }
    const { data } = await supabase
      .from('schedules')
      .select('*, room:rooms(*)')
      .eq('teacher_id', teacher.id)
      .eq('status', 'active')
      .order('start_time')
    setSchedules(data || [])
    setLoading(false)
  }, [supabase, teacher])

  useEffect(() => { load() }, [load])

  if (!teacher) return <div className="text-center py-12 text-gray-500">No teacher profile linked</div>
  if (loading) return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>

  const daySchedules = schedules.filter(s => s.day_of_week === selectedDay)
  const classTypeLabels: Record<string, string> = { '1-to-1': '1-to-1', 'small_group': 'Small Group', 'large_group': 'Large Group' }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Schedule</h1>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {DAYS.map((day, i) => (
          <button
            key={day}
            onClick={() => setSelectedDay(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedDay === i ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {daySchedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No classes scheduled for {DAYS[selectedDay]}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {daySchedules.map(s => (
            <Card key={s.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{s.subject}</h3>
                    <p className="text-sm text-gray-500">{s.exam_system}</p>
                  </div>
                  <Badge variant="secondary">{classTypeLabels[s.class_type] || s.class_type}</Badge>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" /> {s.start_time} — {s.end_time}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {s.room?.name}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
