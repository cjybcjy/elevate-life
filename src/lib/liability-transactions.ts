export const REVOLVING_CREDIT_PAYMENT_METHOD = 'revolving_credit';
export const LIABILITY_DRAWDOWN_TRANSACTION_TYPE = 'LIABILITY_DRAW';

export function isRevolvingCredit(paymentMethod: string | null | undefined) {
  return paymentMethod === REVOLVING_CREDIT_PAYMENT_METHOD;
}

export function isLiabilityDrawdown(transactionType: string | null | undefined) {
  return transactionType === LIABILITY_DRAWDOWN_TRANSACTION_TYPE;
}
