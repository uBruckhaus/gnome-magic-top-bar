# Tray icons

AppIndicator, KStatusNotifierItem and legacy (X11) tray icon support, taken from the
GNOME Shell extension "AppIndicator and KStatusNotifierItem Support"
(https://github.com/ubuntu/gnome-shell-extension-appindicator), version 66 at commit
fbc758a (2026-10-05), by the authors in AUTHORS.md,
licensed GPL-2.0-or-later.

Changes for Magic Top Bar are marked "Magic Top Bar:" in the code:

- indicatorStatusIcon.js: new icons join the right side of the bar; their place is
  Magic Top Bar's (its item lists and dragging), so the "tray-pos" setting is gone.
- preferences/generalPage.js: no "Tray Horizontal Alignment" row (see above).

To update: copy the same files from a newer upstream version over these and apply the
marked changes again.
