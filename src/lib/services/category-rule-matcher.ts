import { prisma } from '@/lib/prisma';

export async function autoCategorizeForUser(userId: string, description: string) {
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
