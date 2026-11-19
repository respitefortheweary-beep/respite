import { admin } from "@/lib/api";
import type { AdminUser, BedState } from "@/lib/types";
import { Sidebar } from "./sidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // also the login check: no token, or an expired one, bounces to /admin/login
  const [{ newRequests, overdue, beds, unreadNotifications, failedEmails, openRepairs = 0 }, me] = await Promise.all([
    admin.get<{
      newRequests: number; overdue: number; beds: BedState[]; unreadNotifications: number; failedEmails: number; openRepairs?: number;
    }>("/admin/summary"),
    admin.get<AdminUser>("/auth/me").catch(() => null),
  ]);
  return (
    <div className="min-h-dvh bg-oat text-ink md:grid md:grid-cols-[236px_minmax(0,1fr)] print:block print:bg-white">
      <Sidebar newRequests={newRequests} overdue={overdue} beds={beds} unread={unreadNotifications} failedEmails={failedEmails} repairs={openRepairs} me={me ? { name: me.name, email: me.email } : null} />
      {/* bottom padding clears the phone tab bar */}
      <div className="min-w-0 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0 print:pb-0">{children}</div>
    </div>
  );
}
