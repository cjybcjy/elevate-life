import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { prisma } from './prisma';
import { authConfig } from './auth.config';
import { generateDerivedKey } from './crypto';
import { setUserKey, deleteUserKey } from './key-cache';
import { validateLoginInput } from './security/credentials';
import { consumeRateLimit } from './security/rate-limit';
import { getClientIp } from './security/request';

const DUMMY_PASSWORD_HASH = '$2b$12$37LdltctWbY3N1/rVAiLbOrFaV2evr/Iur9PAP6jUFb9bmaM7w18y';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { type: 'text' },
        password: { type: 'password' },
      },
      authorize: async (credentials, request) => {
        const validated = validateLoginInput(credentials);
        if (!validated.success) return null;

        const { username, password } = validated.data;
        const clientIp = getClientIp(request.headers);
        const accountIdentifier = username.toLowerCase();
        const [sourceRateLimit, accountRateLimit] = await Promise.all([
          consumeRateLimit({
            scope: 'login-source-account',
            identifier: `${clientIp}:${accountIdentifier}`,
            limit: 10,
            windowMs: 15 * 60 * 1_000,
          }),
          consumeRateLimit({
            scope: 'login-account',
            identifier: accountIdentifier,
            limit: 20,
            windowMs: 15 * 60 * 1_000,
          }),
        ]);
        if (!sourceRateLimit.allowed || !accountRateLimit.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { username },
        });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user) return null;
        if (!valid) return null;

        const derivedKey = generateDerivedKey(password, user.id);
        await setUserKey(user.id, derivedKey);

        return {
          id: user.id,
          name: user.displayName,
          username: user.username,
          derivedKey,
        };
      },
    }),
  ],
  events: {
    signOut: async (message) => {
      const token = 'token' in message ? message.token : null;
      if (token?.sub) await deleteUserKey(token.sub);
    },
  },
});
