'use server';

import { prisma } from '@/lib/prisma';
import { signIn as authSignIn, signOut as authSignOut } from '@/lib/auth';
import bcrypt from 'bcrypt';

export async function registerUser(data: { username: string; password: string; displayName?: string }) {
  try {
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    });
    if (existing) {
      return { success: false, error: 'Username already exists' };
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        displayName: data.displayName,
      },
    });

    return { success: true, data: { id: user.id, username: user.username } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function loginUser(username: string, password: string) {
  try {
    await authSignIn('credentials', { username, password, redirect: false });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Invalid credentials' };
  }
}

export async function logoutUser() {
  await authSignOut({ redirect: false });
  return { success: true };
}
