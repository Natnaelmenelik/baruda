import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import QueryProvider from './providers/QueryProvider';
import AppToaster from '@/components/AppToaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Lottery System',
  description: 'Pick your lucky number and win!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={inter.className}><QueryProvider>{children}<AppToaster /></QueryProvider></body></html>;
}
