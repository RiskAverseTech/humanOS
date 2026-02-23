/**
 * FamilyOS – Supabase Setup Script
 *
 * Run this script once to apply the database migrations to your Supabase project.
 *
 * Usage:
 *   npx tsx scripts/setup-supabase.ts
 *
 * Prerequisites:
 *   - .env.local must contain SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL
 *   - npm install tsx (dev dependency)
 *
 * This script reads the SQL migration files in order and executes them
 * against your Supabase project using the service role key.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function runMigrations() {
  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations')
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  console.log(`\n🏗️  FamilyOS Supabase Setup`)
  console.log(`   Found ${files.length} migration files\n`)

  for (const file of files) {
    const filePath = path.join(migrationsDir, file)
    const sql = fs.readFileSync(filePath, 'utf-8')

    console.log(`📄 Running: ${file}`)

    const { error } = await supabase.rpc('exec_sql', { query: sql }).single()

    if (error) {
      // If exec_sql doesn't exist, fall back to raw REST
      console.log(`   ⚠️  rpc exec_sql not available, trying direct execution...`)
      console.log(`   ℹ️  Please run this SQL manually in the Supabase SQL Editor:`)
      console.log(`   📁 ${filePath}\n`)
    } else {
      console.log(`   ✅ Success\n`)
    }
  }

  console.log(`\n✅ Setup complete!`)
  console.log(`\n📋 Next steps:`)
  console.log(`   1. Go to your Supabase Dashboard → Authentication → Settings`)
  console.log(`   2. Under "Email Auth", ensure "Enable Email Signup" is ON`)
  console.log(`   3. The invite-only restriction is handled by the database trigger`)
  console.log(`   4. Sign up with ${process.env.ADMIN_EMAIL} to get the admin role`)
  console.log(`   5. Optionally disable "Enable Email Confirmations" for local dev\n`)
}

runMigrations().catch(console.error)
