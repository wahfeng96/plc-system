#!/bin/bash

# Get password from .env.local
PASSWORD=$(grep SUPABASE_DB_PASSWORD .env.local 2>/dev/null | cut -d'=' -f2)

# If not found, use default
if [ -z "$PASSWORD" ]; then
  echo "Enter your Supabase database password:"
  read -s PASSWORD
fi

# Apply migration
PGPASSWORD="$PASSWORD" psql \
  -h aws-0-ap-southeast-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.duglpwptidlzrrtgahxr \
  -d postgres \
  -f supabase/migrations/20260421_create_settings.sql

echo ""
echo "Migration completed!"
