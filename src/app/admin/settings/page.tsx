/**
 * Admin: Settings page.
 *
 * - Drive connection status
 * - API key configuration display
 * - Basic system info
 *
 * This is a server component that reads environment variables and
 * the Hermes agent health status.
 */

import { checkHealth, getHermesBaseUrl } from "@/lib/hermes-client";

export default async function AdminSettingsPage() {
  // Check Hermes agent health
  let agentStatus: "online" | "offline" = "offline";
  let agentError: string | null = null;

  try {
    const health = await checkHealth();
    if (health.status === "ok") {
      agentStatus = "online";
    }
  } catch (err) {
    agentError = err instanceof Error ? err.message : "Connection failed";
  }

  // Check Drive configuration
  const driveClientId = process.env.GOOGLE_CLIENT_ID;
  const driveClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const driveRootFolder = process.env.DRIVE_ROOT_FOLDER_ID ?? "root";
  const isDriveConfigured =
    !!driveClientId &&
    !!driveClientSecret &&
    driveClientId !== "your-client-id.apps.googleusercontent.com";

  // Other config
  const hermesUrl = getHermesBaseUrl();
  const databaseUrl = process.env.DATABASE_URL;
  const isDatabaseConfigured =
    !!databaseUrl &&
    !databaseUrl.includes("user:password@localhost");

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">System Settings</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Configuration and status for the Leland Mills AI Assistant
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Agent status */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              AI Agent
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                agentStatus === "online"
                  ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  agentStatus === "online" ? "bg-green-500" : "bg-red-500"
                }`}
              />
              {agentStatus === "online" ? "Online" : "Offline"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            URL: <code className="font-mono text-foreground">{hermesUrl}</code>
          </p>
          {agentError && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-2">
              {agentError}
            </p>
          )}
          {agentStatus === "online" && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              Mock agent or Hermes instance is responding.
            </p>
          )}
          {agentStatus === "offline" && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              Start the mock agent: <code className="font-mono">node mock-agent/server.js</code>
            </p>
          )}
        </div>

        {/* Drive status */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              Google Drive
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                isDriveConfigured
                  ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isDriveConfigured ? "bg-green-500" : "bg-yellow-500"
                }`}
              />
              {isDriveConfigured ? "Configured" : "Not Set Up"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Root folder: <code className="font-mono text-foreground">{driveRootFolder}</code>
          </p>
          {!isDriveConfigured && (
            <div className="mt-2">
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">
                TODO: Jake needs to set up Google Cloud credentials.
              </p>
              <ol className="text-xs text-zinc-500 dark:text-zinc-400 list-decimal pl-4 space-y-0.5">
                <li>Create project at Google Cloud Console</li>
                <li>Enable Google Drive API</li>
                <li>Create OAuth 2.0 credentials</li>
                <li>Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env</li>
              </ol>
            </div>
          )}
        </div>

        {/* Database status */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">
              Database
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                isDatabaseConfigured
                  ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isDatabaseConfigured ? "bg-green-500" : "bg-yellow-500"
                }`}
              />
              {isDatabaseConfigured ? "Connected" : "Default URL"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isDatabaseConfigured
              ? "Database URL is configured."
              : "Using default DATABASE_URL — update .env with your connection string."}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            Run migrations: <code className="font-mono">npx prisma db push</code>
          </p>
        </div>
      </div>

      {/* Configuration details */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Configuration Details
        </h3>
        <dl className="space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">
              Hermes API URL
            </dt>
            <dd className="text-sm font-mono text-foreground">
              {hermesUrl}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">
              Google Client ID
            </dt>
            <dd className="text-sm font-mono text-foreground">
              {driveClientId
                ? `${driveClientId.slice(0, 12)}...`
                : "Not set"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">
              Drive Root Folder
            </dt>
            <dd className="text-sm font-mono text-foreground">
              {driveRootFolder}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">
              Auth Secret
            </dt>
            <dd className="text-sm font-mono text-foreground">
              {process.env.AUTH_SECRET &&
              process.env.AUTH_SECRET !== "change-me-to-a-random-string"
                ? "•••••••• (set)"
                : "⚠ Not set (using default)"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">
              Node Environment
            </dt>
            <dd className="text-sm font-mono text-foreground">
              {process.env.NODE_ENV ?? "development"}
            </dd>
          </div>
        </dl>
      </div>

      {/* TODO: Jake needs to provide the following for production:
          1. A real AUTH_SECRET (generate with: openssl rand -base64 32)
          2. Google Cloud OAuth credentials
          3. A production DATABASE_URL
          4. The real Hermes agent URL (when deployed)
      */}
    </div>
  );
}