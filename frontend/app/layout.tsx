import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: "Resources - RMS",
  description: "Manage employee schedules and project resource bookings",
};

import { Inter } from 'next/font/google'

const myfont = Inter({
  subsets: ['latin'],
  variable: '--font-myfont',
  weight: ['400', '500', '600', '700'],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`antialiased ${myfont.variable}`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
