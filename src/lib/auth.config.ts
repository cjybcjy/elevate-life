import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.username = user.username;
        if (user.derivedKey) token.derivedKey = user.derivedKey;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.username = token.username as string;
        session.user.derivedKey = token.derivedKey as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
