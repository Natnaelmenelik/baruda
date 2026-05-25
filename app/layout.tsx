import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "./providers/QueryProvider";
import AppToaster from "@/components/AppToaster";

export const metadata: Metadata = {
  metadataBase: new URL("https://oddda.vercel.app"),
  title: "ባሩዳ ዶት ኮም",
  description: "የአንጋፋውና ስመ ጥር የሆነው የባሩዳ ዶት ኮም ቤተሰብ ጨዋታ ይወዳደሩ ተሸላሚ ይሁኑ",
  openGraph: {
    title: "ባሩዳ ዶት ኮም",
    description: "የአንጋፋውና ስመ ጥር የሆነው የባሩዳ ዶት ኮም ቤተሰብ ጨዋታ ይወዳደሩ ተሸላሚ ይሁኑ",
    url: "https://baruda.vercel.app",
    siteName: "ባሩዳ ዶት ኮም",
    images: [
      {
        url: "/baruda-dashboard.png",
        width: 1200,
        height: 630,
        alt: "ባሩዳ ዶት ኮም",
      },
    ],
    locale: "am_ET",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ባሩዳ ዶት ኮም",
    description: "የአንጋፋውና ስመ ጥር የሆነው የባሩዳ ዶት ኮም ቤተሰብ ጨዋታ ይወዳደሩ ተሸላሚ ይሁኑ",
    images: ["/baruda-dashboard.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="am" suppressHydrationWarning>
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
      <body>
        <QueryProvider>
          {children}
          <AppToaster />
        </QueryProvider>
      </body>
    </html>
  );
}
