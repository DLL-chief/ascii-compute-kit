#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes esbuild@0.25.12 src/workers/compute.worker.ts \
  --bundle --format=esm --target=es2022 --outfile=pages/compute.worker.js
npx --yes esbuild@0.25.12 pages/app.ts \
  --bundle --format=esm --target=es2022 --outfile=pages/app.js
echo "pages/app.js + pages/compute.worker.js"
