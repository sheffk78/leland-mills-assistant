"use client";

/**
 * Reset Password page.
 *
 * User arrives here via the reset link with a token query param.
 * They enter a new password, which replaces their old one.
 */

import { useState, type FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    // Validate token on mount
    fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => setTokenValid(data.valid === true))
      .catch(() => setTokenValid(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to reset password.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-4 rounded-xl" style={{ backgroundColor: "#FFB800" }}>
            <img
              src="/leland-mills-logo-white-on-transparent.png"
              alt="Leland Mills"
              className="h-16 w-auto object-contain py-2"
            />
          </div>
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm text-center">
            <h1 className="text-xl font-bold text-foreground mb-2">Invalid or Expired Link</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link href="/forgot-password" className="text-sm text-[var(--color-accent)] hover:underline">
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-4 rounded-xl" style={{ backgroundColor: "#FFB800" }}>
          <img
            src="/leland-mills-logo-white-on-transparent.png"
            alt="Leland Mills"
            className="h-16 w-auto object-contain py-2"
          />
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl font-bold text-foreground mb-2">Set New Password</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">
            Enter your new password below.
          </p>

          {success ? (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-3">
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                ✅ Password updated! Redirecting to login...
              </p>
            </div>
          ) : tokenValid === null ? (
            <p className="text-sm text-zinc-500 text-center py-4">Validating link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg py-2.5 text-sm font-bold transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--color-accent)", color: "#000000" }}
              >
                {isLoading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-zinc-500">Loading...</p></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}