#!/bin/sh

ARCH=$(uname -m)

if [ "$ARCH" = "aarch64" ]; then
  echo "Verifying native rollup dependency for ARM64..."
  npm install @rollup/rollup-linux-arm64-gnu --ignore-scripts
  npm rebuild esbuild
fi

echo "Starting Vite preview..."
npm run preview -- --host 0.0.0.0 --port ${PORT:-4444}
