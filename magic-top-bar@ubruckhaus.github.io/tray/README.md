# Tray icons

AppIndicator, KStatusNotifierItem and legacy (X11) tray icon support, taken from the
GNOME Shell extension "AppIndicator and KStatusNotifierItem Support"
(https://github.com/ubuntu/gnome-shell-extension-appindicator), version 66 at commit
fbc758a (2026-10-05), by the authors in AUTHORS.md,
licensed GPL-2.0-or-later.

Changes for Magic Top Bar are marked "Magic Top Bar:" in the code:

- indicatorStatusIcon.js: new icons join the right side of the bar; their place is
  Magic Top Bar's (its item lists and dragging), so the "tray-pos" setting is gone.
- preferences/generalPage.js: no "Tray Horizontal Alignment" row (see above); saturation,
  brightness and contrast read with get_double() (upstream read them as integers), and
  values saved on notify::value instead of the spin rows' input/output signals.
- interfaces.js: the D-Bus interfaces are in the file (interfaces-xml/ is gone): no file
  reads in the shell, no deprecated ByteArray module.
- promiseUtils.js: no `connect_once` added to the prototypes of GObject.Object and
  Signals.EventEmitter (a `connectOnce()` function instead); MetaLaterPromise removed
  (unused, Meta.later_add() is not in GNOME 51); cancellations use plain 'cancelled'
  signal connections, disconnected at once instead of from an idle.
- util.js: `connectOnce()` for the startup wait; CancellableChild disconnects from its
  parent at once instead of from an idle.
- indicatorStatusIcon.js: the double-click wait is cancelled when its icon is destroyed;
  legacy icons have no touch handling (it built events with APIs GNOME 51 does not have).
- statusNotifierWatcher.js: the bus analyser process is ended on destroy.
- appIndicator.js: the temporary image of a wide custom icon is destroyed after a timeout
  or a cancellation too.

Starting and stopping (tray.js, outside this folder) creates the bus name watcher in
enable() and destroys it in disable(), where upstream kept it for the extension's life.

To update: copy the same files from a newer upstream version over these and apply the
marked changes again.
