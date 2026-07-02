/**
 * Admin panel layout.
 *
 * Provides a consistent header with navigation for all admin pages.
 * The actual access control is handled by the proxy (src/proxy.ts) which
 * requires ADMIN role for /admin routes.
 */

import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/chat");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--color-accent)" }}
            >
              <span className="text-white font-bold text-sm">LM</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">
                Admin Panel
              </h1>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Leland Mills AI Assistant
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href="/admin/users"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Users
            </Link>
            <Link
              href="/admin/usage"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Usage &amp; Limits
            </Link>
            <Link
              href="/admin/settings"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/chat"
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Chat
            </Link>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}