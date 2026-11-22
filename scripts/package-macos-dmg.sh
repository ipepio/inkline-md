#!/usr/bin/env bash
#
# Empaqueta Inkline para macOS con firma ad-hoc real.
#
# `pnpm tauri build --bundles dmg` deja el .app con una firma ad-hoc que no
# sella los recursos del bundle: `codesign --verify` responde «code has no
# resources but signature indicates they must be present» y macOS trata la app
# como dañada. Este script firma el bundle completo y arma el .dmg él mismo.
#
# Uso:
#   ./scripts/package-macos-dmg.sh            # versión de tauri.conf.json
#   ./scripts/package-macos-dmg.sh /ruta/salida
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
APP="src-tauri/target/release/bundle/macos/Inkline.app"
OUT_DIR="${1:-dist-macos}"
DMG="$OUT_DIR/Inkline_${VERSION}_aarch64.dmg"

echo "→ Compilando Inkline ${VERSION} (bundle .app)"
pnpm tauri build --bundles app

echo "→ Firmando el bundle en ad-hoc"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

echo "→ Creando $DMG"
STAGE="$(mktemp -d)/dmg-stage"
mkdir -p "$STAGE" "$OUT_DIR"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create -volname "Inkline" -srcfolder "$STAGE" -ov -format UDZO -quiet "$DMG"
rm -rf "$(dirname "$STAGE")"

echo "→ Verificando la firma dentro de la imagen"
MOUNT=$(hdiutil attach -nobrowse -readonly "$DMG" | awk '/\/Volumes\// {print $1}')
trap 'hdiutil detach "$MOUNT" >/dev/null 2>&1 || true' EXIT
codesign --verify --deep --strict --verbose=2 "/Volumes/Inkline/Inkline.app"
codesign -dv "/Volumes/Inkline/Inkline.app" 2>&1 | grep -E "Identifier=|Signature="

echo "✓ $DMG ($(du -h "$DMG" | cut -f1))"
echo "  Recuerda: sin Developer ID ni notarización, macOS seguirá diciendo"
echo "  «desarrollador no identificado»; eso solo lo resuelve la firma real."
