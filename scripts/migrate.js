#!/usr/bin/env node
/**
 * scripts/migrate.js
 *
 * Applies SQL migration files to Supabase using the service role key.
 * Run with: node scripts/migrate.js
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */
const fs = require("fs");
const path = require("path");

// Load .env manually (no dotenv dep required for scripts)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const migrationsDir = path.resolve(process.cwd(), "db/migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

(async () => {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Running migration: ${file}`);

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ sql }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Migration failed (${file}):`, text);
      // Note: use the Supabase SQL editor or `supabase db push` for production migrations
      console.info("Tip: run migrations directly in the Supabase SQL editor for the initial setup.");
    } else {
      console.log(`✓ ${file}`);
    }
  }

  console.log("Migrations complete.");
})();
