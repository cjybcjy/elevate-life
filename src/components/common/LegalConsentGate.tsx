'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LEGAL_CONSENT_CHANGED_EVENT,
  LEGAL_CONSENT_STORAGE_KEY,
  LEGAL_CONSENT_VERSION,
  shouldBypassLegalConsent,
} from '@/lib/legal-consent';

type ConsentRecord = {
  version: string;
  acceptedAt: string;
};

function readConsent() {
  if (typeof window === 'undefined') return true;

  try {
    const rawValue = localStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
    if (!rawValue) return false;
    const record = JSON.parse(rawValue) as Partial<ConsentRecord>;
    return record.version === LEGAL_CONSENT_VERSION;
  } catch {
    return false;
  }
}

function subscribeToConsentChanges(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(LEGAL_CONSENT_CHANGED_EVENT, callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(LEGAL_CONSENT_CHANGED_EVENT, callback);
  };
}

export default function LegalConsentGate() {
  const pathname = usePathname();
  const [declined, setDeclined] = useState(false);
  const bypass = shouldBypassLegalConsent(pathname);
  const hasConsent = useSyncExternalStore(
    subscribeToConsentChanges,
    () => bypass || readConsent(),
    () => true,
  );

  function acceptConsent() {
    const record: ConsentRecord = {
      version: LEGAL_CONSENT_VERSION,
      acceptedAt: new Date().toISOString(),
    };
    localStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new Event(LEGAL_CONSENT_CHANGED_EVENT));
    setDeclined(false);
  }

  if (bypass || hasConsent) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-consent-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(15, 23, 42, 0.42)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <section
        style={{
          width: 'min(520px, 100%)',
          borderRadius: 8,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-elevated)',
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
        }}
      >
        <h2 id="legal-consent-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text-primary)' }}>
          请先阅读并同意
        </h2>
        <p style={{ marginTop: 12, lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
          使用 Elevate Life 家庭账本前，请阅读
          <Link href="/terms" style={{ color: 'var(--color-primary)', fontWeight: 700 }}> 用户协议 </Link>
          和
          <Link href="/privacy" style={{ color: 'var(--color-primary)', fontWeight: 700 }}> 隐私政策 </Link>
          。应用会处理账号信息、家庭财务数据、预算、流水和资金账户，用于提供家庭财务管理服务。
        </p>
        {declined && (
          <p style={{ marginTop: 12, lineHeight: 1.6, color: 'var(--color-danger)' }}>
            需要同意用户协议和隐私政策后才能继续使用登录、记账、资产和预算功能。
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 22 }}>
          <button type="button" className="btn btn-outline" onClick={() => setDeclined(true)}>
            不同意
          </button>
          <button type="button" className="btn btn-primary" onClick={acceptConsent}>
            同意并继续
          </button>
        </div>
      </section>
    </div>
  );
}
