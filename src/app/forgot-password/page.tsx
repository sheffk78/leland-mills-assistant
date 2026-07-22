"use client";

/**
 * Forgot Password page.
 *
 * User enters their email, we send a reset link.
 * Since Leland Mills doesn't have email infrastructure yet,
 * the reset link is displayed on screen (admin can copy/send to the user).
 * In production, this would email the link via Postmark/Resend.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setResetLink(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("If an account exists for that email, a reset link has been generated.");
        if (data.resetLink) {
          setResetLink(data.resetLink);
        }
      } else {
        setMessage("If an account exists for that email, a reset link has been generated.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="flex items-center justify-center mb-4 rounded-xl" style={{ backgroundColor: "#FFB800" }}>
          <img
            src="/leland-mills-logo-white-on-transparent.png"
            alt="Leland Mills"
            className="h-16 w-auto object-contain py-2"
          />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl font-bold text-foreground mb-2">Reset Password</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
            Enter your email and we&apos;ll generate a password reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@lelandmills.com"
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {message && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2">
                <p className="text-sm text-green-700 dark:text-green-400">{message}</p>
              </div>
            )}

            {resetLink && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 px-3 py-3">
                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-400 mb-1">
                  Reset Link (copy and send to the user):
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-500 break-all font-mono bg-yellow-100/50 dark:bg-yellow-900/20 px-2 py-1 rounded">
                  {resetLink}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg py-2.5 text-sm font-bold transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--color-accent)", color: "#000000" }}
            >
              {isLoading ? "Generating..." : "Send Reset Link"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-zinc-500 hover:text-foreground">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}