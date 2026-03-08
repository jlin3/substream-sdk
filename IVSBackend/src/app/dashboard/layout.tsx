import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { DashboardShell } from './components';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <DashboardShell orgName={session.orgName} orgSlug={session.orgSlug}>
      {children}
    </DashboardShell>
  );
}
