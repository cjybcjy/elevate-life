'use server';

import { prisma } from '@/lib/prisma';
import { auth, signIn as authSignIn, signOut as authSignOut } from '@/lib/auth';
import { rotateUserEncryptedFields, validatePasswordChangeInput } from '@/lib/account-password';
import { generateDerivedKey } from '@/lib/crypto';
import { setUserKey } from '@/lib/key-cache';
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
  } catch {
    return { success: false, error: 'Invalid credentials' };
  }
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const validation = validatePasswordChangeInput(data);
  if (!validation.success) return validation;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) return { success: false, error: '账号不存在' };

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) return { success: false, error: '当前密码不正确' };

    const oldDerivedKey = generateDerivedKey(data.currentPassword, userId);
    const newDerivedKey = generateDerivedKey(data.newPassword, userId);
    const passwordHash = await bcrypt.hash(data.newPassword, 12);

    await prisma.$transaction(async (tx) => {
      const assets = await tx.asset.findMany({
        where: { userId },
        select: { id: true, balance: true, costPrice: true },
      });
      const liabilities = await tx.liability.findMany({
        where: { userId },
        select: {
          id: true,
          principal: true,
          currentBalance: true,
          monthlyPayment: true,
        },
      });
      const possessions = await tx.possession.findMany({
        where: { userId },
        select: { id: true, purchasePrice: true, soldPrice: true },
      });

      const rotated = rotateUserEncryptedFields({
        userId,
        oldDerivedKey,
        newDerivedKey,
        assets,
        liabilities,
        possessions,
      });

      for (const asset of rotated.assets) {
        await tx.asset.update({
          where: { id: asset.id },
          data: {
            balance: asset.balance,
            costPrice: asset.costPrice,
            isEncrypted: true,
          },
        });
      }

      for (const liability of rotated.liabilities) {
        await tx.liability.update({
          where: { id: liability.id },
          data: {
            principal: liability.principal,
            currentBalance: liability.currentBalance,
            monthlyPayment: liability.monthlyPayment,
            isEncrypted: true,
          },
        });
      }

      for (const possession of rotated.possessions) {
        await tx.possession.update({
          where: { id: possession.id },
          data: {
            purchasePrice: possession.purchasePrice,
            soldPrice: possession.soldPrice,
            isEncrypted: true,
          },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
    });

    await setUserKey(userId, newDerivedKey);
    return { success: true };
  } catch {
    return { success: false, error: '修改密码失败，请确认当前密码可以解锁已有财务数据' };
  }
}

export async function logoutUser() {
  await authSignOut({ redirect: false });
  return { success: true };
}
