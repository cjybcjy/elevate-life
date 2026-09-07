import Decimal from 'decimal.js';
import { isLiabilityDrawdown } from './liability-transactions';

export type TransactionEffectInput = {
  type: string;
  amount: Decimal.Value;
  fromAccountId: string | null;
  toAccountId: string | null;
  liabilityId: string | null;
};

export type TransactionEffectDelta = {
  id: string;
  delta: Decimal;
};

function addDelta(deltas: Map<string, Decimal>, id: string | null, delta: Decimal) {
  if (!id || delta.isZero()) return;
  deltas.set(id, (deltas.get(id) ?? new Decimal(0)).plus(delta));
}

function collectEffectDeltas(
  deltas: {
    assetDeltas: Map<string, Decimal>;
    liabilityDeltas: Map<string, Decimal>;
  },
  effect: TransactionEffectInput,
  direction: 1 | -1,
) {
  const amount = new Decimal(effect.amount);
  addDelta(deltas.assetDeltas, effect.fromAccountId, amount.negated().mul(direction));
  addDelta(deltas.assetDeltas, effect.toAccountId, amount.mul(direction));
  const liabilityDelta = isLiabilityDrawdown(effect.type) ? amount : amount.negated();
  addDelta(deltas.liabilityDeltas, effect.liabilityId, liabilityDelta.mul(direction));
}

function toDeltaList(deltas: Map<string, Decimal>): TransactionEffectDelta[] {
  return Array.from(deltas.entries())
    .map(([id, delta]) => ({ id, delta }))
    .filter((entry) => !entry.delta.isZero());
}

export function buildTransactionEffectDeltas(
  existing: TransactionEffectInput,
  next: TransactionEffectInput,
) {
  const deltas = {
    assetDeltas: new Map<string, Decimal>(),
    liabilityDeltas: new Map<string, Decimal>(),
  };

  collectEffectDeltas(deltas, existing, -1);
  collectEffectDeltas(deltas, next, 1);

  return {
    assetDeltas: toDeltaList(deltas.assetDeltas),
    liabilityDeltas: toDeltaList(deltas.liabilityDeltas),
  };
}
