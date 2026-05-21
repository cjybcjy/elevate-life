import type { NextAuthOptions } from 'next-auth';

export const authConfig = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    jwt: async ({ token, user }: { token: any; user: any }) => {
      if (user) {
        token.username = user.username;
      }
      return token;
    },
    session: async ({ session, token }: { session: any; token: any }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthOptions;
