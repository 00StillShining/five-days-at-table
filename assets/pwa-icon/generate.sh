#!/bin/sh
# Regenerates public/icon-512.png and public/icon-180.png (apple-touch-icon) from
# icon.svg in this folder. Run manually after editing icon.svg — these PNGs are
# committed static assets (Phase 2 SW/manifest work, docs/BUILD-STATE.md), not part
# of `npm run build`, so the build stays platform-agnostic (sips is macOS-only).
#
# Colors: field #D9D8D4 = Sol light field / --sol-bg (SOL-BRIEF R1, atlas §4.2).
# Wordmark #FF5A1F = --sol-accent-fill (the app's single act-now accent, reused here
# as the most recognizable brand mark). Rule #8A2E00 = --sol-accent (text-safe pair).
#
# Requires `sips` (ships with macOS; verified here on macOS 26.5 to rasterize SVG
# natively, including re-rendering at the target pixel size rather than just
# downscaling a fixed raster). Fallback if a future macOS drops sips SVG support:
#   qlmanage -t -s 512 -o . icon.svg   # produces icon.svg.png via QuickLook
set -eu
cd "$(dirname "$0")"

sips -s format png -z 512 512 icon.svg --out ../../public/icon-512.png
sips -s format png -z 180 180 icon.svg --out ../../public/icon-180.png

echo "Wrote public/icon-512.png and public/icon-180.png"
