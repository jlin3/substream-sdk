import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Substream',
  description: 'Live streaming SDK for games — stream any canvas with 5 lines of code',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface-50 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
