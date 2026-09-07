'use client';

import { useCallback, useSyncExternalStore } from 'react';

export const STOCK_MANUAL_PRINCIPAL_STORAGE_KEY = 'stock-manual-principal';
export const STOCK_IDLE_CASH_STORAGE_KEY = 'stock-idle-cash';

function getChangedEventName(key: string) {
  return `elevate-life:stored-number-changed:${key}`;
}

function readStoredNumber(key: string): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = localStorage.getItem(key);
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function subscribeStoredNumber(key: string, callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  const changedEventName = getChangedEventName(key);

  window.addEventListener('storage', handleStorage);
  window.addEventListener(changedEventName, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(changedEventName, callback);
  };
}

function getServerSnapshot() {
  return null;
}

export function useStoredNumber(key: string) {
  const subscribe = useCallback(
    (callback: () => void) => subscribeStoredNumber(key, callback),
    [key],
  );
  const getSnapshot = useCallback(() => readStoredNumber(key), [key]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function saveStoredNumber(key: string, value: number) {
  if (typeof window === 'undefined' || !Number.isFinite(value)) return false;

  try {
    localStorage.setItem(key, value.toString());
    window.dispatchEvent(new Event(getChangedEventName(key)));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredNumber(key: string) {
  if (typeof window === 'undefined') return false;

  try {
    localStorage.removeItem(key);
    window.dispatchEvent(new Event(getChangedEventName(key)));
    return true;
  } catch {
    return false;
  }
}
