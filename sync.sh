#!/bin/bash
cd /home/house/email
# Ensure we are on main branch
git checkout main
# Set git user if not set
git config user.email "hermes@local" || true
git config user.name "Hermes Agent" || true
# Set pull to merge by default (not rebase)
git config pull.rebase false
while true; do
  # Add all changes
  git add -A
  # Commit if there are changes
  if ! git diff-index --quiet HEAD --; then
    git commit -m "auto-sync $(date +%s)"
  fi
  # Fetch latest from origin
  git fetch origin
  # Determine relationship between local HEAD and origin/main
  if git merge-base --is-ancestor HEAD origin/main; then
    # Local is behind origin/main (or equal): fast-forward
    git merge --ff-only origin/main
  elif git merge-base --is-ancestor origin/main HEAD; then
    # Local is ahead of origin/main: nothing to merge, just push later
    :
  else
    # Histories have diverged: try to merge with unrelated histories allowed
    git merge --no-edit --allow-unrelated-histories origin/main 2>>sync.log || true
  fi
  # Push to origin/main
  git push origin main 2>>sync.log || true
  sleep 10
done