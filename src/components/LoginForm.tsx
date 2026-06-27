"use client";

/**
 * Login form component.
 *
 * - Email + password fields for admin/staff
 * - PIN code field for drivers
 * - Submit button with loading state
 * - Error message display
 * - Toggle between login modes
 * - Educational onboarding for new users
 * - Leland Mills brand styling matching lelandmills.com
 */

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type LoginMode = "credentials" | "pin";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        ...(mode === "credentials"
          ? { email, password }
          : { pinCode }),
      });

      if (result?.error) {
        setError(
          mode === "credentials"
            ? "Invalid email or password."
            : "Invalid PIN code.",
        );
        return;
      }

      if (result?.ok) {
        router.push("/chat");
        router.refresh();
      } else {
        setError("Login failed. Please try again.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Brand header — gold background matching lelandmills.com */}
      <div
        className="rounded-2xl overflow-hidden mb-6 shadow-lg"
        style={{ backgroundColor: "#FFB800" }}
      >
        <div className="flex items-center justify-center px-6 py-8">
          <img
            src="/leland-mills-logo.png"
            alt="Leland Mills"
            className="h-14 w-auto"
          />
        </div>
      </div>

      {/* Welcome text — educational for new users */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          AI Assistant
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Your smart operations companion for Leland Mills. Get instant answers
          about truck inspections, feed inventory, DOT compliance, and safety
          procedures.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        {/* Mode tabs */}
        <div className="flex gap-1 p-1 bg-black/5 dark:bg-white/5 rounded-lg mb-5">
          <button
            type="button"
            onClick={() => {
              setMode("credentials");
              setError(null);
            }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === "credentials"
                ? "bg-background text-foreground shadow-sm"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Staff Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("pin");
              setError(null);
            }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === "pin"
                ? "bg-background text-foreground shadow-sm"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            Driver Login
          </button>
        </div>

        {/* Contextual help text for each mode */}
        <div className="mb-4 px-1">
          {mode === "credentials" ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              For office staff, managers, and administrators. Use your Leland
              Mills email and password.
            </p>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              For delivery drivers. Enter the PIN code assigned to you by
              dispatch. No email needed.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "credentials" ? (
            <>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
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
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-zinc-400 focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
            </>
          ) : (
            <div>
              <label
                htmlFor="pinCode"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
                PIN Code
              </label>
              <input
                id="pinCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pinCode}
                onChange={(e) =>
                  setPinCode(e.target.value.replace(/\D/g, ""))
                }
                required
                autoComplete="one-time-code"
                placeholder="Enter your PIN"
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-center text-2xl tracking-[0.5em] text-foreground placeholder:text-zinc-400 placeholder:tracking-normal placeholder:text-base focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 text-center">
                Enter the PIN code assigned to you by dispatch.
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : mode === "credentials" ? (
              "Sign In"
            ) : (
              "Enter"
            )}
          </button>
        </form>
      </div>

      {/* Footer with heritage tagline */}
      <div className="text-center mt-6">
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Leland Mills Feed Company
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">
          Fresh Feed Milled Daily Since 1898
        </p>
      </div>

      {/* New user help section */}
      <div className="mt-6 p-4 rounded-xl border border-border bg-surface">
        <h3 className="text-xs font-semibold text-foreground mb-2">
          First time here?
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
          This assistant helps you with day-to-day operations:
        </p>
        <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
          <li className="flex items-start gap-2">
            <span style={{ color: "var(--color-accent)" }}>•</span>
            Truck pre-trip and post-trip inspection checklists
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "var(--color-accent)" }}>•</span>
            Feed inventory levels and reorder points
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "var(--color-accent)" }}>•</span>
            DOT hours of service rules and limits
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: "var(--color-accent)" }}>•</span>
            Safety procedures and lockout/tagout protocols
          </li>
        </ul>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-3">
          Contact your manager for login credentials.
        </p>
      </div>
    </div>
  );
}