import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - ResourceUtil',
  description: 'View resource and project analytics',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
