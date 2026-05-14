import { useState } from 'react';
import Decimal from 'decimal.js-light';

interface AmountDisplayProps {
  amount: number | string | Decimal;
  currency?: string;
  prefix?: string;
  className?: string;
  showSign?: boolean;
  sensitive?: boolean;
}

export function AmountDisplay({
  amount,
  prefix = '¥',
  className = '',
  showSign = false,
  sensitive = false,
}: AmountDisplayProps) {
  const [revealed, setRevealed] = useState(false);

  const decimal = new Decimal(amount);
  const isNegative = decimal.isNegative();
  const absoluteValue = decimal.abs();

  const formatted = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absoluteValue.toNumber());

  const sign = showSign ? (isNegative ? '-' : '+') : isNegative ? '-' : '';

  const mask = (value: string): string => {
    // Replace digits with *, keep separators
    let masked = '';
    for (const char of value) {
      if (char >= '0' && char <= '9') {
        masked += '*';
      } else {
        masked += char;
      }
    }
    return masked;
  };

  const displayValue = sensitive && !revealed ? mask(formatted) : formatted;

  return (
    <span
      className={`font-mono inline-flex items-center gap-1 ${sensitive ? 'cursor-pointer select-none' : ''} ${className}`}
      onClick={sensitive ? () => setRevealed(!revealed) : undefined}
      title={sensitive ? (revealed ? '点击隐藏' : '点击显示') : undefined}
    >
      {sign}{prefix}{displayValue}
      {sensitive && (
        <span className="text-ledger-muted text-xs ml-0.5">
          {revealed ? '🙈' : '👁'}
        </span>
      )}
    </span>
  );
}
