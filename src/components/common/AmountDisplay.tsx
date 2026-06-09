'use client';

import { useState } from 'react';

interface Props {
  amount: number | string;
  prefix?: string;
  className?: string;
  showSign?: boolean;
  sensitive?: boolean;
  sensitiveThreshold?: number;
}

export function AmountDisplay({
  amount,
  prefix = '¥',
  className = '',
  showSign = false,
  sensitive = false,
  sensitiveThreshold = 200000,
}: Props) {
  const [revealed, setRevealed] = useState(false);

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const isNegative = num < 0;
  const absoluteValue = Math.abs(num);

  const formatted = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absoluteValue);

  const sign = showSign ? (isNegative ? '-' : '+') : isNegative ? '-' : '';

  const mask = (value: string): string => {
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

  const shouldHide = sensitive && absoluteValue >= sensitiveThreshold;
  const displayValue = shouldHide && !revealed ? mask(formatted) : formatted;

  return (
    <span
      className={`font-mono inline-flex items-center gap-1 ${shouldHide ? 'cursor-pointer select-none' : ''} ${className}`}
      onClick={shouldHide ? () => setRevealed(!revealed) : undefined}
      title={shouldHide ? (revealed ? '点击隐藏' : '点击显示') : undefined}
    >
      {sign}{prefix}{displayValue}
      {shouldHide && (
        <span className="text-ledger-muted text-xs ml-0.5">
          {revealed ? '🙈' : '👁'}
        </span>
      )}
    </span>
  );
}
