import type { NextAuthOptions } from 'next-auth'
import { getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** 환경변수 ADMIN_EMAILS(쉼표로 구분)의 관리자 이메일 목록. */
export const adminEmails = () => (process.env.ADMIN_EMAILS ?? '').split(',').map(email => email.trim()).filter(Boolean)

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
      const isEnvAdmin = adminEmails().includes(email)

      // 2) DB role + suspended 체크 (매 요청마다)
      try {
        const supabase = createAdminClient()
        const [roleRes, suspendedRes] = await Promise.all([
          supabase.schema('limbus').rpc('get_user_role', { user_email: email }),
          supabase.schema('limbus').rpc('is_user_suspended', { user_email: email }),
        ])
        if (roleRes.error) throw new Error(roleRes.error.message)
        if (suspendedRes.error) throw new Error(suspendedRes.error.message)
        token.isAdmin = isEnvAdmin || roleRes.data === 'admin'
        token.isWanjang = isEnvAdmin || roleRes.data === 'wanjang' || roleRes.data === 'admin'
        token.isSuspended = suspendedRes.data === true
      } catch {
        // DB 조회 실패 시 stale token 권한/정지 상태를 신뢰하지 않는다.
        token.isAdmin = false
        token.isWanjang = false
        token.isSuspended = true
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

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isAdmin) {
    return { error: true as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) }
  }
  if (session.user.isSuspended) {
    return { error: true as const, response: NextResponse.json({ error: '이용이 정지된 계정입니다.' }, { status: 403 }) }
  }
  return { error: false as const, session }
}

/**
 * Requires an authenticated, non-suspended user.
 * Returns 401 if not logged in, 403 if suspended.
 */
export async function requireActiveUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { error: true as const, response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) }
  }
  if (session.user.isSuspended) {
    return { error: true as const, response: NextResponse.json({ error: '이용이 정지된 계정입니다.' }, { status: 403 }) }
  }
  return { error: false as const, session }
}

/**
 * Requires sign-in only; suspension is not looked at here. A suspended account still reads what is its own (inquiries,
 * notifications), but its writes (POST/PUT/PATCH/DELETE under /api) are refused earlier by proxy.ts, so the 403 never reaches this check.
 */
export async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { error: true as const, response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) }
  }
  return { error: false as const, session }
}
