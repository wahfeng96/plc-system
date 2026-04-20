'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard, Users, GraduationCap, DoorOpen, Calendar,
  CalendarOff, ClipboardList, FileText, Clock, UserCheck,
  BookOpen, Receipt, ShieldCheck, DollarSign, Library, Settings, Calculator
} from 'lucide-react'

const adminLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/timetable', label: 'Timetable', icon: Calendar },
  { href: '/classes', label: 'Classes', icon: Library },
  { href: '/teachers', label: 'Teachers', icon: Users },
  { href: '/students', label: 'Students', icon: GraduationCap },
  { href: '/rooms', label: 'Rooms', icon: DoorOpen },
  { href: '/attendance', label: 'Attendance', icon: ClipboardList },
  { href: '/tuition-fees', label: 'Tuition Fees', icon: DollarSign },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/holidays', label: 'Holidays', icon: CalendarOff },
  { href: '/users', label: 'Users', icon: ShieldCheck },
  { href: '/headcount-rental', label: 'Headcount & Rental', icon: Calculator },
  { href: '/settings/exam-systems', label: 'Settings', icon: Settings },
]

const teacherLinks = [
  { href: '/my-schedule', label: 'My Schedule', icon: Clock },
  { href: '/take-attendance', label: 'Attendance', icon: UserCheck },
  { href: '/my-students', label: 'My Students', icon: BookOpen },
  { href: '/tuition-fees', label: 'Tuition Fees', icon: DollarSign },
  { href: '/my-rental', label: 'My Rental', icon: Receipt },
]

const guardLinks = [
  { href: '/guard', label: "Today's Schedule", icon: DoorOpen },
]

export function Sidebar() {
  const pathname = usePathname()
  const { role, allowedPages } = useAuth()
  const baseLinks = role === 'admin' ? adminLinks : role === 'teacher' ? teacherLinks : guardLinks
  // Admin always sees all. Other roles: filter by allowedPages if set
  const links = (role === 'admin' || !allowedPages || allowedPages.length === 0)
    ? baseLinks
    : baseLinks.filter(l => allowedPages.includes(l.href))

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r">
      <div className="flex items-center gap-3 h-16 px-6 border-b">
        <Image src="/plc-logo.jpg" alt="PLC Logo" width={36} height={36} className="rounded-full" />
        <h1 className="text-lg font-bold text-blue-600">PLC System</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t text-xs text-gray-400">
        {role.charAt(0).toUpperCase() + role.slice(1)} account
      </div>
    </aside>
  )
}
