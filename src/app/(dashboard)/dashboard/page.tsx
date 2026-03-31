'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, GraduationCap, Calendar, DollarSign } from 'lucide-react'

export default function DashboardPage() {
  const { role, teacher } = useAuth()
  const [stats, setStats] = useState({ students: 0, teachers: 0, classesThisWeek: 0, monthlyRevenue: 0 })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const today = new Date()
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

      if (role === 'admin') {
        const [studentsRes, teachersRes, sessionsRes, invoicesRes] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('class_sessions').select('id', { count: 'exact', head: true })
            .gte('date', getMonday(today).toISOString().split('T')[0])
            .lte('date', getSunday(today).toISOString().split('T')[0])
            .neq('status', 'cancelled'),
          supabase.from('invoices').select('grand_total').eq('month', currentMonth),
        ])

        const revenue = (invoicesRes.data || []).reduce((sum, inv) => sum + (inv.grand_total || 0), 0)

        setStats({
          students: studentsRes.count || 0,
          teachers: teachersRes.count || 0,
          classesThisWeek: sessionsRes.count || 0,
          monthlyRevenue: revenue,
        })
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
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
