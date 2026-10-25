#!/bin/sh
# Builds dist/magic-top-bar@ubruckhaus.github.io.shell-extension.zip (schemas included).
set -eu
cd "$(dirname "$0")/.."
UUID=magic-top-bar@ubruckhaus.github.io
mkdir -p dist
gnome-extensions pack "$UUID" --force --out-dir dist \
    --extra-source=items.js --extra-source=order.js --extra-source=barDrag.js \
    --extra-source=tray.js --extra-source=settingsButton.js --extra-source=tray --extra-source=../LICENSE
echo "dist/$UUID.shell-extension.zip"
