import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { prisma } from './prisma';
import { authConfig } from './auth.config';
import { generateDerivedKey } from './crypto';
import { setUserKey, deleteUserKey } from './key-cache';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { type: 'text' },
        password: { type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

        const derivedKey = generateDerivedKey(credentials.password as string, user.id);
        await setUserKey(user.id, derivedKey);

        return {
          id: user.id,
          name: user.displayName,
          username: user.username,
        };
      },
    }),
  ],
  events: {
    signOut: async ({ token }) => {
      if (token?.sub) await deleteUserKey(token.sub);
    },
  },
});
