'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidateTag } from 'next/cache';

export async function getCategoryRules() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  const rules = await prisma.categoryRule.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { priority: 'desc' },
  });

  const data = rules.map((r) => ({
    ...r,
    category: r.category
      ? {
          ...r.category,
          essentialRatio: r.category.essentialRatio.toNumber(),
        }
      : null,
  }));
  return { success: true, data };
}

export async function createCategoryRule(data: {
  keyword: string;
  categoryId: string;
  priority?: number;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const rule = await prisma.categoryRule.create({
      data: {
        keyword: data.keyword.trim(),
        categoryId: data.categoryId,
        priority: data.priority ?? 0,
        userId,
      },
      include: { category: true },
    });

    revalidateTag(`user-${userId}`, 'default');
    return {
      success: true,
      data: {
        ...rule,
        category: rule.category
          ? { ...rule.category, essentialRatio: rule.category.essentialRatio.toNumber() }
          : null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCategoryRule(id: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    await prisma.categoryRule.deleteMany({ where: { id, userId } });
    revalidateTag(`user-${userId}`, 'default');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Auto-categorize based on description matching user's category rules.
 * Returns categoryId if a match is found, null otherwise.
 */
export async function autoCategorize(userId: string, description: string): Promise<string | null> {
  if (!description) return null;

  const rules = await prisma.categoryRule.findMany({
    where: { userId },
    orderBy: { priority: 'desc' },
  });

  const lower = description.toLowerCase();
  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      return rule.categoryId;
    }
  }

  return null;
}
