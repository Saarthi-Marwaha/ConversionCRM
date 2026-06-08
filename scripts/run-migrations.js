#!/usr/bin/env node
/**
 * scripts/run-migrations.js
 *
 * Runs all SQL migration files in db/migrations/ against Supabase.
 * Connects via the Supabase session pooler using the service role key
 * as the JWT password (supported on Supabase's newer Supavisor infrastructure).
 *
 * Usage:
 *   node scripts/run-migrations.js
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Extract project ref from the Supabase URL
// e.g. https://gjihgmjzpwewcaqnbbtf.supabase.co  →  gjihgmjzpwewcaqnbbtf
const projectRef = supabaseUrl.replace("https://", "").split(".")[0];

// Connection options to try in order:
// 1. Direct DB host  (newer infra accepts JWT as password)
// 2. Session pooler  (Supavisor, port 5432)
const CONNECTION_OPTIONS = [
  {
    label: "Direct connection",
    config: {
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      database: "postgres",
      user: "postgres",
      password: serviceKey,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    },
  },
  {
    label: "Session pooler (us-east-1)",
    config: {
      host: `aws-0-us-east-1.pooler.supabase.com`,
      port: 5432,
      database: "postgres",
      user: `postgres.${projectRef}`,
      password: serviceKey,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    },
  },
  {
    label: "Session pooler (us-west-1)",
    config: {
      host: `aws-0-us-west-1.pooler.supabase.com`,
      port: 5432,
      database: "postgres",
      user: `postgres.${projectRef}`,
      password: serviceKey,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    },
  },
  {
    label: "Session pooler (eu-west-1)",
    config: {
      host: `aws-0-eu-west-1.pooler.supabase.com`,
      port: 5432,
      database: "postgres",
      user: `postgres.${projectRef}`,
      password: serviceKey,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    },
  },
  {
    label: "Session pooler (ap-south-1)",
    config: {
      host: `aws-0-ap-south-1.pooler.supabase.com`,
      port: 5432,
      database: "postgres",
      user: `postgres.${projectRef}`,
      password: serviceKey,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    },
  },
  {
    label: "Session pooler (ap-southeast-1)",
    config: {
      host: `aws-0-ap-southeast-1.pooler.supabase.com`,
      port: 5432,
      database: "postgres",
      user: `postgres.${projectRef}`,
      password: serviceKey,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    },
  },
];

async function tryConnect() {
  for (const option of CONNECTION_OPTIONS) {
    process.stdout.write(`  Trying ${option.label}... `);
    const client = new Client(option.config);
    try {
      await client.connect();
      await client.query("SELECT 1");
      console.log("✅  Connected!");
      return client;
    } catch (err) {
      console.log(`❌  ${err.message.split("\n")[0]}`);
      try { await client.end(); } catch {}
    }
  }
  return null;
}

async function runMigrations(client) {
  const migrationsDir = path.join(__dirname, "..", "db", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`\n📂  Found ${files.length} migration file(s):\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");

    console.log(`  ▶  Running ${file}...`);
    try {
      await client.query(sql);
      console.log(`     ✅  Done`);
    } catch (err) {
      // If the error is "already exists" — skip it (idempotent run)
      if (
        err.message.includes("already exists") ||
        err.message.includes("duplicate")
      ) {
        console.log(`     ⚠️   Already applied (skipped)`);
      } else {
        console.error(`     ❌  Error: ${err.message}`);
        throw err;
      }
    }
  }
}

(async () => {
  console.log("\n🔌  Connecting to Supabase...\n");

  const client = await tryConnect();

  if (!client) {
    console.error(`
❌  Could not connect with any method.

This usually means the service role key cannot be used as a direct database
password on your Supabase plan. To run migrations manually:

1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new
2. Paste and run:  db/migrations/001_initial_schema.sql
3. Then run:       db/migrations/002_add_product_name.sql
`);
    process.exit(1);
  }

  try {
    await runMigrations(client);
    console.log("\n✅  All migrations complete!\n");
  } catch (err) {
    console.error("\n❌  Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
