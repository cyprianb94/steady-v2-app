#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
brand_dir="$repo_root/assets/brand"
app_assets_dir="$repo_root/packages/app/assets"
landing_assets_dir="$repo_root/landing/assets"
landing_brand_dir="$landing_assets_dir/brand"

copy_png() {
  local src="$1"
  local dest="$2"

  cp "$src" "$dest"
}

resize_png() {
  local src="$1"
  local dest="$2"
  local size="$3"

  sips -s format png -z "$size" "$size" "$src" --out "$dest" >/dev/null
}

mkdir -p "$app_assets_dir" "$landing_brand_dir"

copy_png "$brand_dir/steady-app-icon.png" "$app_assets_dir/icon.png"
copy_png "$brand_dir/steady-app-icon.png" "$app_assets_dir/splash-icon.png"
copy_png "$brand_dir/steady-app-icon.png" "$app_assets_dir/android-icon-foreground.png"
resize_png "$brand_dir/steady-app-icon.png" "$app_assets_dir/favicon.png" 48

copy_png "$brand_dir/steady-app-icon.png" "$landing_brand_dir/steady-app-icon.png"
copy_png "$brand_dir/steady-wordmark.png" "$landing_brand_dir/steady-wordmark.png"
cp "$brand_dir/steady-wordmark.svg" "$landing_brand_dir/steady-wordmark.svg"
resize_png "$brand_dir/steady-app-icon.png" "$landing_assets_dir/favicon.png" 48
