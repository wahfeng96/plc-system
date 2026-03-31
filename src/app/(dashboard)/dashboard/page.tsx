'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, GraduationCap, Calendar, DollarSign, Plus, Clock, Activity, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { DAYS } from '@/lib/types'
import type { Schedule } from '@/lib/types'

interface TodayClass {
  id: string
  subject: string
  start_time: string
  end_time: string
  class_type: string
  teacher_name: string
  room_name: string
}

interface RecentAttendance {
  id: string
  status: string
  marked_at: string
  student_name: string
  teacher_name: string
  subject: string
}

export default function DashboardPage() {
  const { role, teacher } = useAuth()
  const [stats, setStats] = useState({ students: 0, teachers: 0, classesThisWeek: 0, monthlyRevenue: 0 })
  const [todayClasses, setTodayClasses] = useState<TodayClass[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const today = new Date()
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      const todayDayOfWeek = today.getDay()

      if (role === 'admin') {
        const [studentsRes, teachersRes, sessionsRes, invoicesRes, schedulesRes, attendanceRes] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('class_sessions').select('id', { count: 'exact', head: true })
            .gte('date', getMonday(today).toISOString().split('T')[0])
            .lte('date', getSunday(today).toISOString().split('T')[0])
            .neq('status', 'cancelled'),
          supabase.from('invoices').select('grand_total').eq('month', currentMonth),
          supabase.from('schedules')
            .select('*, teacher:teachers(name), room:rooms(name)')
            .eq('day_of_week', todayDayOfWeek)
            .eq('status', 'active'),
          supabase.from('attendance')
            .select('*, student:students(name), class_session:class_sessions(teacher_id, schedule:schedules(subject), teacher:teachers(name))')
            .order('marked_at', { ascending: false })
            .limit(5),
        ])

        const revenue = (invoicesRes.data || []).reduce((sum, inv) => sum + (inv.grand_total || 0), 0)

        setStats({
          students: studentsRes.count || 0,
          teachers: teachersRes.count || 0,
          classesThisWeek: sessionsRes.count || 0,
          monthlyRevenue: revenue,
        })

        // Today's classes from schedules
        const classes: TodayClass[] = (schedulesRes.data || []).map((s: Schedule & { teacher?: { name: string }; room?: { name: string } }) => ({
          id: s.id,
          subject: s.subject,
          start_time: s.start_time,
          end_time: s.end_time,
          class_type: s.class_type,
          teacher_name: s.teacher?.name || '',
          room_name: s.room?.name || '',
        })).sort((a: TodayClass, b: TodayClass) => a.start_time.localeCompare(b.start_time))
        setTodayClasses(classes)

        // Recent activity
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activity: RecentAttendance[] = (attendanceRes.data || []).map((a: any) => ({
          id: a.id,
          status: a.status,
          marked_at: a.marked_at,
          student_name: a.student?.name || '',
          teacher_name: a.class_session?.teacher?.name || '',
          subject: a.class_session?.schedule?.subject || '',
        }))
        setRecentActivity(activity)
      } else if (role === 'teacher' && teacher) {
        const [studentsRes, sessionsRes] = await Promise.all([
          supabase.from('student_subjects').select('id', { count: 'exact', head: true })
            .eq('teacher_id', teacher.id).eq('status', 'active'),
          supabase.from('class_sessions').select('id', { count: 'exact', head: true })
            .eq('teacher_id', teacher.id)
            .gte('date', getMonday(today).toISOString().split('T')[0])
            .lte('date', getSunday(today).toISOString().split('T')[0])
            .neq('status', 'cancelled'),
        ])

        setStats({
          students: studentsRes.count || 0,
          teachers: 0,
          classesThisWeek: sessionsRes.count || 0,
          monthlyRevenue: 0,
        })
      }

      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, teacher])

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-gray-500">Loading...</div>
  }

  const adminCards = [
    { title: 'Active Students', value: stats.students, icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
    { title: 'Active Teachers', value: stats.teachers, icon: Users, color: 'text-green-600 bg-green-50' },
    { title: 'Classes This Week', value: stats.classesThisWeek, icon: Calendar, color: 'text-purple-600 bg-purple-50' },
    { title: 'Monthly Revenue', value: `RM ${stats.monthlyRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-orange-600 bg-orange-50' },
  ]

  const teacherCards = [
    { title: 'My Students', value: stats.students, icon: GraduationCap, color: 'text-blue-600 bg-blue-50' },
    { title: 'Classes This Week', value: stats.classesThisWeek, icon: Calendar, color: 'text-purple-600 bg-purple-50' },
  ]

  const cards = role === 'admin' ? adminCards : teacherCards

  const classTypeBadge = (type: string) => {
    const map: Record<string, string> = {
      '1-to-1': 'bg-purple-100 text-purple-700',
      'small_group': 'bg-blue-100 text-blue-700',
      'large_group': 'bg-green-100 text-green-700',
    }
    const labels: Record<string, string> = {
      '1-to-1': '1-to-1',
      'small_group': 'Small Group',
      'large_group': 'Large Group',
    }
    return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${map[type] || 'bg-gray-100'}`}>{labels[type] || type}</span>
  }

  const attendanceStatusColor: Record<string, string> = {
    present: 'text-green-600',
    absent: 'text-red-600',
    late: 'text-yellow-600',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-500">{card.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions - Admin only */}
      {role === 'admin' && (
        <div className="flex flex-wrap gap-3 mt-6">
          <Link href="/students">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Add Student
            </Button>
          </Link>
          <Link href="/teachers">
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Add Teacher
            </Button>
          </Link>
          <Link href="/timetable">
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" /> View Timetable
            </Button>
          </Link>
        </div>
      )}

      {/* Today's Classes & Recent Activity */}
      {role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Today's Classes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Today&apos;s Classes ({DAYS[new Date().getDay()]})
                </CardTitle>
                <Link href="/timetable">
                  <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                    View All <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {todayClasses.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No classes scheduled today</p>
              ) : (
                <div className="space-y-2">
                  {todayClasses.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{c.subject}</span>
                          {classTypeBadge(c.class_type)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.teacher_name} &middot; {c.room_name}</div>
                      </div>
                      <div className="text-sm font-medium text-blue-600 whitespace-nowrap ml-2">
                        {c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Recent Activity
                </CardTitle>
                <Link href="/attendance">
                  <Button variant="ghost" size="sm" className="text-xs text-blue-600">
                    View All <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No recent attendance records</p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{a.student_name}</div>
                        <div className="text-xs text-gray-500">{a.subject} &middot; {a.teacher_name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-xs ${attendanceStatusColor[a.status]}`}>
                          {a.status}
                        </Badge>
                        <span className="text-[10px] text-gray-400">
                          {a.marked_at ? new Date(a.marked_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function getSunday(d: Date) {
  const monday = getMonday(d)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday
}
