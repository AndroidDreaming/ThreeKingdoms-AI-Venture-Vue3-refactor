#!/bin/sh
set -eu

cd /app

mkdir -p /app/server/runtime/auth
mkdir -p /app/server/runtime/sessions-v5
mkdir -p /app/server/runtime/session-logs-v5

exec node server/indexCampaignV5ServerManagedV2.js
