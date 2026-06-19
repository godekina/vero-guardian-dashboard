import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';
import { WalletProvider } from '@/context/WalletContext';
import { RoleProvider } from '@/context/RoleContext';
import { AlertProvider } from '@/context/AlertContext';
import { ToastProvider } from '@/components/Toast';
import { ErrorProvider } from '@/components/ErrorModal';
import { ThemeProvider } from '@/context/ThemeContext';
import { I18nProvider } from '@/i18n';
import { NetworkProvider } from '@/context/NetworkContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vero Guardian Dashboard',
  description: 'Decentralized Validation Network Dashboard',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): ReactElement {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
        <I18nProvider>
          <AlertProvider>
            <ThemeProvider>
              <WalletProvider>
                <RoleProvider>
                  <ToastProvider>
                    {children}
                  </ToastProvider>
                </RoleProvider>
              </WalletProvider>
            </ThemeProvider>
          </AlertProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
