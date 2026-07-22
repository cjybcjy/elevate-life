export interface GoalForecastGoal {
  id: string;
  name: string;
  assetId?: string | null;
  color?: string | null;
}

export interface GoalForecastRecurringRule {
  id: string;
  type: string;
  amount: number;
  toAccountId?: string | null;
  frequency: string;
  interval: number;
  nextDueDate: Date | string;
  isActive: boolean;
}

export interface GoalContributionEvent {
  id: string;
  date: string;
  month: string;
  goalId: string;
  goalName: string;
  amount: number;
  color?: string | null;
}

export interface GoalContributionPlan {
  events: GoalContributionEvent[];
  total: number;
  averageMonthly: number;
  monthlyByGoal: Record<string, number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: Date | string) {
  const parsed = value instanceof Date
    ? new Date(value.getTime())
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);

  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatDateKey(value: Date) {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, '0'),
    String(value.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addUtcMonths(value: Date, months: number, anchorDay: number) {
  const monthStart = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  monthStart.setUTCDate(Math.min(anchorDay, daysInUtcMonth(monthStart.getUTCFullYear(), monthStart.getUTCMonth())));
  return monthStart;
}

function nextOccurrence(value: Date, frequency: string, interval: number, anchorDay: number) {
  const safeInterval = Math.max(1, Math.floor(interval || 1));

  if (frequency === 'daily') {
    return new Date(value.getTime() + safeInterval * DAY_MS);
  }

  if (frequency === 'weekly') {
    return new Date(value.getTime() + safeInterval * 7 * DAY_MS);
  }

  if (frequency === 'yearly') {
    return addUtcMonths(value, safeInterval * 12, anchorDay);
  }

  return addUtcMonths(value, safeInterval, anchorDay);
}

function monthStart(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function monthEnd(month: string) {
  const start = monthStart(month);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1);
}

/**
 * Converts concrete recurring transfers into future goal-contribution events.
 * A rule is only considered a contribution when it transfers into the asset
 * linked to exactly one savings goal, which avoids double-counting shared assets.
 */
export function buildGoalContributionPlan({
  goals,
  rules,
  months,
}: {
  goals: GoalForecastGoal[];
  rules: GoalForecastRecurringRule[];
  months: string[];
}): GoalContributionPlan {
  if (months.length === 0) {
    return { events: [], total: 0, averageMonthly: 0, monthlyByGoal: {} };
  }

  const goalsByAsset = new Map<string, GoalForecastGoal[]>();
  for (const goal of goals) {
    if (!goal.assetId) continue;
    goalsByAsset.set(goal.assetId, [...(goalsByAsset.get(goal.assetId) ?? []), goal]);
  }

  const firstMonth = monthStart(months[0]);
  const lastMonth = monthEnd(months[months.length - 1]);
  const allowedMonths = new Set(months);
  const events: GoalContributionEvent[] = [];

  for (const rule of rules) {
    if (!rule.isActive || rule.type.toUpperCase() !== 'TRANSFER' || !rule.toAccountId) continue;

    const matchedGoals = goalsByAsset.get(rule.toAccountId) ?? [];
    if (matchedGoals.length !== 1) continue;

    const amount = safeNumber(rule.amount);
    const dueDate = parseDate(rule.nextDueDate);
    if (!dueDate || amount <= 0) continue;

    const goal = matchedGoals[0];
    const anchorDay = dueDate.getUTCDate();
    let occurrence = dueDate;
    let guard = 0;

    while (occurrence < firstMonth && guard < 10_000) {
      occurrence = nextOccurrence(occurrence, rule.frequency, rule.interval, anchorDay);
      guard += 1;
    }

    while (occurrence <= lastMonth && guard < 10_000) {
      const date = formatDateKey(occurrence);
      const month = date.slice(0, 7);

      if (allowedMonths.has(month)) {
        events.push({
          id: `${rule.id}-${date}`,
          date,
          month,
          goalId: goal.id,
          goalName: goal.name,
          amount,
          color: goal.color,
        });
      }

      occurrence = nextOccurrence(occurrence, rule.frequency, rule.interval, anchorDay);
      guard += 1;
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.goalName.localeCompare(b.goalName, 'zh-CN'));

  const monthlyByGoal: Record<string, number> = {};
  for (const goal of goals) {
    const totalForGoal = events
      .filter((event) => event.goalId === goal.id)
      .reduce((sum, event) => sum + event.amount, 0);
    monthlyByGoal[goal.id] = totalForGoal / months.length;
  }

  const total = events.reduce((sum, event) => sum + event.amount, 0);
  return {
    events,
    total,
    averageMonthly: total / months.length,
    monthlyByGoal,
  };
}

export function buildProjectedAvailableCash({
  months,
  cumulative,
  currentCash,
  events,
}: {
  months: string[];
  cumulative: number[];
  currentCash: number;
  events: GoalContributionEvent[];
}) {
  const contributionByMonth = new Map<string, number>();
  for (const event of events) {
    contributionByMonth.set(event.month, (contributionByMonth.get(event.month) ?? 0) + event.amount);
  }

  let contributed = 0;
  return months.map((month, index) => {
    contributed += contributionByMonth.get(month) ?? 0;
    return safeNumber(currentCash) + safeNumber(cumulative[index]) - contributed;
  });
}
