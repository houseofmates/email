#!/bin/bash
cd /home/house/email
# Ensure git user config
git config user.email "hermes@local" || true
git config user.name "Hermes Agent" || true
while true; do
  # Add all changes
  git add -A
  # Commit if there are changes
  if ! git diff-index --quiet HEAD --; then
    git commit -m "auto-sync $(date +%s)"
    # Try to pull first with unrelated histories allowed, then push
    git pull origin main --allow-unrelated-histories --no-edit 2>>sync.log || true
    git push origin main 2>>sync.log || true
  else
    # No local changes, just pull
    git pull origin main --allow-unrelated-histories --no-edit 2>>sync.log || true
  fi
  sleep 10
done