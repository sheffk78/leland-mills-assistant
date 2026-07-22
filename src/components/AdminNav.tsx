"use client";

/**
 * Admin navigation — responsive.
 *
 * - Desktop (md+): inline nav links in the header
 * - Mobile (<md): hamburger button that opens a dropdown panel
 *
 * Uses a click-outside listener to close the dropdown.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/permissions", label: "Permissions" },
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/usage", label: "Usage & Limits" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/chat", label: "Chat" },
];

export function AdminNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <>
      {/* Desktop nav — inline links + logout */}
      <nav className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "text-foreground font-medium bg-black/5 dark:bg-white/5"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="px-3 py-1.5 rounded-lg text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 1 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          Log Out
        </button>
      </nav>

      {/* Mobile nav — hamburger + dropdown */}
      <div ref={menuRef} className="md:hidden relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-2 rounded-lg text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            {menuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
              />
            )}
          </svg>
        </button>

        {/* Dropdown panel */}
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-border bg-surface shadow-lg overflow-hidden z-50">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-3 text-sm transition-colors border-b border-border last:border-b-0 ${
                    isActive
                      ? "text-foreground font-medium bg-black/5 dark:bg-white/5"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
              className="block w-full text-left px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-t border-border"
            >
              Log Out
            </button>
          </div>
        )}
      </div>
    </>
  );
}