#!/bin/bash
set -e

# Wait for MinIO to be ready
echo "Waiting for MinIO..."
until mc alias set local http://minio:9000 minioadmin minioadmin 2>/dev/null; do
  sleep 1
done

# Create the email bucket
mc mb local/email --ignore-existing
echo "MinIO bucket 'email' created."
