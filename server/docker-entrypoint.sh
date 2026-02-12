#!/bin/sh
set -eu

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting backend..."
exec node dist/main
