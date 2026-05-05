import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import QueryProvider from './providers/QueryProvider';
import AppToaster from '@/components/AppToaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ኦዳ የመኪና እቁብ ሎተሪ',
  description: 'የእድል ቁጥርዎን ይምረጡ እና ያሸንፉ!',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="am"><head>
        <script
          id="theme-init-script"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme !== 'light') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (_) {}
            `,
          }}
        />
      </head><body className={inter.className}><QueryProvider>{children}<AppToaster /></QueryProvider></body></html>;
}
