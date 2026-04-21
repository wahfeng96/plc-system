#!/bin/bash

# Apply settings migration to PLC Supabase
# Run this script to create the settings table

SUPABASE_URL="https://duglpwptidlzrrtgahxr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1Z2xwd3B0aWRsenJydGdhaHhyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDkzNzIxMywiZXhwIjoyMDkwNTEzMjEzfQ.8XVNV8ub896J9Bid-dgsZS3UaP_A5OEOkyJ_nrniahQ"

SQL=$(cat supabase/migrations/20260421_create_settings.sql)

curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": $(echo "$SQL" | jq -Rs .)}"

echo ""
echo "Migration applied!"
