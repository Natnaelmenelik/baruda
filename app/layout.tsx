import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import QueryProvider from "./providers/QueryProvider";
import AppToaster from "@/components/AppToaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://oddda.vercel.app'),
  title: 'ኦዳ የመኪና እቁብ ሎተሪ',
  description: 'ከዕድለኛ ቁጥርዎ ጋር የመኪና እድልዎን ይሞክሩ!',
  openGraph: {
    title: 'ኦዳ የመኪና እቁብ ሎተሪ',
    description: 'ከዕድለኛ ቁጥርዎ ጋር የመኪና እድልዎን ይሞክሩ!',
    url: 'https://oddda.vercel.app',
    siteName: 'ኦዳ የመኪና እቁብ ሎተሪ',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ኦዳ የመኪና እቁብ ሎተሪ',
      },
    ],
    locale: 'am_ET',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ኦዳ የመኪና እቁብ ሎተሪ',
    description: 'ከዕድለኛ ቁጥርዎ ጋር የመኪና እድልዎን ይሞክሩ!',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="am">
      <head>
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
      </head>
      <body className={inter.className}>
        <QueryProvider>
          {children}
          <AppToaster />
        </QueryProvider>
      </body>
    </html>
  );
}
