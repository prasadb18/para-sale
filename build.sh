#!/bin/bash
set -e

echo "==> Installing server dependencies..."
npm install --prefix server

echo "==> Installing client dependencies..."
npm install --prefix client --legacy-peer-deps

echo "==> Building client..."
cd client && npm run build

echo "==> Build complete."
