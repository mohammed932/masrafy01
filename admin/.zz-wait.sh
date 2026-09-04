#!/bin/zsh
cd /Users/HD/Programming/masrafy01/admin
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/admin/auth/login -H 'Content-Type: application/json' -d '{"email":"ops@masrafy.local","password":"'"$SEED_ADMIN_PASSWORD"'"}')
  if [ "$code" = "200" ]; then echo "login ok after ${i} polls"; break; fi
  sleep 30
done
SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" node .zz-dark.mjs "$1"
