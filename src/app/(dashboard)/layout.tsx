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
    .select('role')
    .eq('id', user.id)
    .single()

  const role: UserRole = (profile?.role as UserRole) || 'pending'

  // Block pending users
  if (role === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Pending Approval</h1>
          <p className="text-gray-500 mb-6">
            Your account has been created but is waiting for admin approval. 
            Please contact the administrator to get access.
          </p>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="px-4 py-2 bg-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-300">
              Sign Out
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Read allowed_pages from user metadata
  const allowedPages: string[] | null = (user.user_metadata?.allowed_pages as string[]) || null

  // If teacher, get teacher record
  let teacher: Teacher | null = null
  if (role === 'teacher') {
    // Try by user_id first, then by teacher_id in metadata
    const teacherId = user.user_metadata?.teacher_id as string | undefined
    const { data } = teacherId
      ? await supabase.from('teachers').select('*').eq('id', teacherId).single()
      : await supabase.from('teachers').select('*').eq('user_id', user.id).single()
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
