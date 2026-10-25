# Magic Top Bar

A GNOME Shell extension that lets you arrange GNOME's top bar the direct way:

- **Drag items in the bar.** Hold the left mouse button on any item (clock,
  system menu, Activities, tray icons, extension icons) and move it: the other
  items make room, and you can drop it on the left, in the centre or on the
  right. A plain click still opens the item's menu as before.
- **Transparent bar.** Double-click the empty part of the bar to make its
  background transparent; double-click again for the normal bar.
- **Order, sides and visibility in Settings.** The items are three lists
  (left, centre, right) whose rows you drag within a list or between lists, or
  move with each row's menu. Each item can be *Default*, *Hidden* (always
  hidden) or *Always shown*. *Forget* removes an item that is gone for good.
- **Tray icons.** Apps' AppIndicator / KStatusNotifierItem icons (Nextcloud,
  Steam, Discord, update notifiers, …) and legacy X11 tray icons appear in the
  bar with their menus, like with the extension *AppIndicator and
  KStatusNotifierItem Support*, which Magic Top Bar replaces. The *Tray Icons*
  page sets their opacity, desaturation, brightness, contrast, size and
  spacing; *Custom Icons* replaces an app's icon with one from your icon theme.
  New tray icons start on the right; drag them anywhere like other items.
- **Settings button.** An icon in the bar opens the settings. It is an item
  like the others: drag it anywhere, or set it to *Hidden* in the settings
  (then open them from the Extensions app).
- **Remembered.** The order survives logins and the screen lock. Items that
  are not in the bar right now (an extension switched off, an app's tray icon
  while the app is closed) keep their place for when they come back. Tray
  icons are recognised by their app, so they keep their place too.

Settings: the transparent background, and switches for the double-click and
for dragging in the bar. Requires GNOME Shell 51.

It does the job of two extensions: *Top Bar Organizer* (whose ideas it
follows, with its own code) and *AppIndicator and KStatusNotifierItem Support*
(whose code it contains, in `tray/`; see `tray/README.md`). Switch those two
off when you use Magic Top Bar.

## License

GPL-2.0-or-later (see `LICENSE`), because the tray code in `tray/` comes from
the AppIndicator extension under that license, by the authors in
`tray/AUTHORS.md`. The rest is by Uwe Bruckhaus.

## Install

```sh
tools/build.sh
gnome-extensions install --force dist/magic-top-bar@ubruckhaus.github.io.shell-extension.zip
# log out and back in (Wayland), then:
gnome-extensions enable magic-top-bar@ubruckhaus.github.io
```

## Development

- `gjs -m tests/items.test.js` tests the item lists (moving, keeping absent items).
- `tools/headless-test.sh <scenario>` runs the packaged extension in a throwaway
  headless GNOME Shell with its own D-Bus, dconf and data folders, so your session
  is untouched. Scenarios in `tools/scenarios/`: `bar` (order from the settings,
  dragging items with a virtual pointer, a click still opening a menu, the
  double-click over a maximized window, the right side in reverse, "Always
  shown", GNOME's places after disabling), `dragclick` (a click on an item right
  after dragging it), `button` (the settings button: a click opens the settings,
  a drag does not), `tray` (a tray app from
  `tests/tray-app/`: its icon, its menu, dragging it, disable/enable),
  `prefs` (screenshot of the settings; `PAGE=tray` or `PAGE=icons` for the tray
  pages). `KEEP_LOG=file` keeps the shell's whole log.
  Screenshots go to `dist/screenshots/`.
- `gsettings set org.gnome.shell.extensions.magic-top-bar debug true` writes the
  extension's decisions to the journal (`journalctl -f -o cat /usr/bin/gnome-shell`).
