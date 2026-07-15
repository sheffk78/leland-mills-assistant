/**
 * Admin panel layout.
 *
 * Provides a consistent header with navigation for all admin pages.
 * The actual access control is handled by the proxy (src/proxy.ts) which
 * requires ADMIN role for /admin routes.
 *
 * Responsive: nav links are inline on desktop, collapse into a
 * hamburger dropdown menu on mobile.
 */

import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    redirect("/chat");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <header className="border-b border-border bg-surface sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--color-accent)" }}
            >
              <span className="text-white font-bold text-sm">LM</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground">
                Admin Panel
              </h1>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Leland Mills AI Assistant
              </p>
            </div>
          </div>

          <AdminNav />
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}