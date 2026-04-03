import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { AuthProvider } from '@/lib/auth-context'
import { Sidebar } from '@/components/sidebar'
import { BottomNav } from '@/components/bottom-nav'
import { DashboardHeader } from '@/components/dashboard-header'
import type { UserRole, Teacher } from '@/lib/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user profile for role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, allowed_pages')
    .eq('id', user.id)
    .single()

  const role: UserRole = (profile?.role as UserRole) || 'teacher'
  const allowedPages: string[] | null = profile?.allowed_pages || null

  // If teacher, get teacher record
  let teacher: Teacher | null = null
  if (role === 'teacher') {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('user_id', user.id)
      .single()
    teacher = data
  }

  return (
    <AuthProvider value={{ userId: user.id, role, teacher, allowedPages }}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="md:pl-64">
          <DashboardHeader />
          <main className="p-4 md:p-6 pb-20 md:pb-6">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </AuthProvider>
  )
}
