export const metadata = {
  title: 'IVS Streaming Backend',
  description: 'AWS IVS streaming backend for Substream SDK',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
