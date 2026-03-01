import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { createAdminClient } from '@/lib/supabase/admin'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      // user.email은 로그인 시에만 존재, 이후에는 token.email 사용
      const email = user?.email ?? token.email
      if (!email) return token

      // 1) 환경변수 ADMIN_EMAILS 체크
      const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
      if (admins.includes(email)) {
        token.isAdmin = true
        token.isWanjang = true
        token.isSuspended = false
        return token
      }

      // 2) DB role + suspended 체크 (매 요청마다)
      try {
        const supabase = createAdminClient()
        const [roleRes, suspendedRes] = await Promise.all([
          supabase.schema('limbus').rpc('get_user_role', { user_email: email }),
          supabase.schema('limbus').rpc('is_user_suspended', { user_email: email }),
        ])
        token.isAdmin = roleRes.data === 'admin'
        token.isWanjang = roleRes.data === 'wanjang' || roleRes.data === 'admin'
        token.isSuspended = suspendedRes.data === true
      } catch {
        // DB 조회 실패 시 기존 값 유지 (첫 로그인이면 기본값)
        token.isAdmin ??= false
        token.isWanjang ??= false
        token.isSuspended ??= false
      }

      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.isAdmin = token.isAdmin as boolean
        session.user.isWanjang = token.isWanjang as boolean
        session.user.isSuspended = token.isSuspended as boolean
      }
      return session
    },
  },
}
