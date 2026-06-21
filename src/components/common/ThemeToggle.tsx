'use client';

import { useEffect, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark';
const themeChangeEvent = 'elevate-life-theme-change';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

function setDocumentTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function notifyThemeChange() {
  window.dispatchEvent(new Event(themeChangeEvent));
}

function applyTheme(theme: Theme) {
  setDocumentTheme(theme);
  localStorage.setItem('theme', theme);
  notifyThemeChange();
}

function getInitialTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

function subscribeToThemeChanges(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    if (!getStoredTheme()) callback();
  };
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === 'theme') callback();
  };

  window.addEventListener(themeChangeEvent, callback);
  window.addEventListener('storage', handleStorageChange);
  mediaQuery.addEventListener('change', handleSystemThemeChange);

  return () => {
    window.removeEventListener(themeChangeEvent, callback);
    window.removeEventListener('storage', handleStorageChange);
    mediaQuery.removeEventListener('change', handleSystemThemeChange);
  };
}

function getServerThemeSnapshot(): Theme {
  return 'light';
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToThemeChanges,
    getInitialTheme,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    setDocumentTheme(theme);
  }, [theme]);

  useEffect(() => {
    setDocumentTheme(getInitialTheme());
    notifyThemeChange();
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost btn-sm"
      title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'}
      aria-label="切换主题"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
