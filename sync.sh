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
    git push origin main 2>>sync.log || true
  fi
  # Fetch and try to integrate remote changes
  git fetch origin main
  # Attempt to fast-forward if no local changes
  if git diff-index --quiet HEAD --; then
    git merge --ff-only origin/main 2>>sync.log || true
  else
    # Local changes exist, try merge
    git merge origin/main --no-edit 2>>sync.log || true
  fi
  sleep 10
done