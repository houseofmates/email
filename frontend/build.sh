#!/bin/bash
set -e
cd /home/house/email/frontend
npx vite build --outDir dist 2>&1
