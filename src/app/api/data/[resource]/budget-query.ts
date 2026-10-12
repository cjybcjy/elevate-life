export function parseBudgetQuery(query: URLSearchParams, requireCategory: boolean) {
  const date = query.get('date') ?? '';
  const parsed = new Date(date);
  if (query.getAll('date').length !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return { error: 'Invalid date' } as const;
  }

  const categoryId = query.get('categoryId') ?? '';
  if (requireCategory && (query.getAll('categoryId').length !== 1
    || !/^[a-zA-Z0-9_-]{1,128}$/.test(categoryId))) {
    return { error: 'Invalid categoryId' } as const;
  }

  return { date, categoryId } as const;
}
