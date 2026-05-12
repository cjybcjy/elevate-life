import Decimal from 'decimal.js-light';

interface AmountDisplayProps {
  amount: number | string | Decimal;
  currency?: string;
  prefix?: string;
  className?: string;
  showSign?: boolean;
}

export function AmountDisplay({
  amount,
  currency = 'CNY',
  prefix = '¥',
  className = '',
  showSign = false,
}: AmountDisplayProps) {
  const decimal = new Decimal(amount);
  const isNegative = decimal.isNegative();
  const absoluteValue = decimal.abs();

  const formatted = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absoluteValue.toNumber());

  const sign = showSign ? (isNegative ? '-' : '+') : isNegative ? '-' : '';

  return (
    <span className={`font-mono ${className}`}>
      {sign}{prefix} {formatted} {currency}
    </span>
  );
}
