# Settings Migration Instructions

## What This Does
- Creates a `settings` table to store system-wide configuration
- Makes the RM15/hr and RM5/student rates adjustable through Settings page
- Admin can now change rates anytime without code changes

## Apply This Migration

**Option 1: Supabase SQL Editor (Easiest)**

1. Go to: https://supabase.com/dashboard/project/duglpwptidlzrrtgahxr/sql/new
2. Copy-paste the SQL from: `supabase/migrations/20260421_create_settings.sql`
3. Click "Run"
4. Done!

**Option 2: Command Line**

```bash
cd ~/Projects/plc-system
bash apply_settings_migration.sh
```

## After Migration

1. Visit https://plc-system.onrender.com/settings (admin only)
2. Adjust rates as needed
3. The Headcount & Rental page will automatically use the new rates

## Default Values
- Rental fee per hour: RM 15
- Head count fee per student: RM 5

(These match the old hardcoded values, so nothing changes until you update them)
