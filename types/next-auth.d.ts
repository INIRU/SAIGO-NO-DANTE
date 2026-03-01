import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      isAdmin?: boolean
      isWanjang?: boolean
      isSuspended?: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin?: boolean
    isWanjang?: boolean
    isSuspended?: boolean
  }
}
