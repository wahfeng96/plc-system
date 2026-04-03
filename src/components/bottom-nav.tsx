'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard, Calendar, ClipboardList, Menu,
  Clock, UserCheck, BookOpen, DoorOpen
} from 'lucide-react'

const adminNav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/timetable', label: 'Timetable', icon: Calendar },
  { href: '/attendance', label: 'Attendance', icon: ClipboardList },
  { href: '/teachers', label: 'More', icon: Menu },
]

const teacherNav = [
  { href: '/my-schedule', label: 'Schedule', icon: Clock },
  { href: '/take-attendance', label: 'Attendance', icon: UserCheck },
  { href: '/my-students', label: 'Students', icon: BookOpen },
  { href: '/my-rental', label: 'Rental', icon: Menu },
]

const guardNav = [
  { href: '/guard', label: 'Schedule', icon: DoorOpen },
]

export function BottomNav() {
  const pathname = usePathname()
  const { role } = useAuth()

  const nav = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : guardNav

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
      <div className="flex justify-around items-center h-16">
        {nav.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 text-xs',
                active ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
