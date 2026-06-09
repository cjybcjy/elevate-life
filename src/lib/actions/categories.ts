'use server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

export async function getCategories() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  // Convert Decimal fields to plain numbers for client serialization
  const data = categories.map((c) => ({
    id: c.id,
    userId: c.userId,
    name: c.name,
    type: c.type,
    isEssential: c.isEssential,
    essentialRatio: c.essentialRatio.toNumber(),
    icon: c.icon,
    color: c.color,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  return { success: true, data };
}

export async function createCategory(data: { name: string; type: string; icon?: string; color?: string; isEssential?: boolean }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const category = await prisma.category.create({
      data: { ...data, userId },
    });
    revalidateTag(`user-${userId}`, 'default');
    return {
      success: true,
      data: {
        ...category,
        essentialRatio: category.essentialRatio.toNumber(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCategory(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.category.deleteMany({ where: { id, userId } });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}