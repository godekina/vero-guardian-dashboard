'use client';

import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon, Laptop } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 opacity-0" aria-hidden="true" />
    );
  }

  const cycleTheme = () => {
    if (theme === 'system') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    } else {
      setTheme(theme === 'light' ? 'dark' : 'system');
    }
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <Laptop className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    }
    return theme === 'dark' ? (
      <Moon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
    ) : (
      <Sun className="w-5 h-5 text-amber-600 dark:text-amber-400" />
    );
  };

  const getAriaLabel = () => {
    return `Current theme is ${theme}. Click to change theme.`;
  };

  return (
    <button
      onClick={cycleTheme}
      aria-label={getAriaLabel()}
      className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
    >
      {getIcon()}
    </button>
  );
}
