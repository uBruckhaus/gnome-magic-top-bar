# Screenshot of the settings (test-only patch), with an item hidden and one from a tray.
$S set org.gnome.shell.extensions.magic-top-bar hidden-items "['keyboard']"
$S set org.gnome.shell.extensions.magic-top-bar left-items "['activities', 'appindicator:nextcloud']"
# Decimal tray settings (shown on PAGE=tray: 0.4, 0.2, 0.3, not 0).
$S set org.gnome.shell.extensions.magic-top-bar icon-saturation 0.4
$S set org.gnome.shell.extensions.magic-top-bar icon-brightness 0.2
$S set org.gnome.shell.extensions.magic-top-bar icon-contrast 0.3
cat >> "$EXT/extension.js" <<'JS'
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
const _origEnable = MagicTopBarExtension.prototype.enable;
MagicTopBarExtension.prototype.enable = function () {
    _origEnable.call(this);
    if (this._testStarted)
        return;
    this._testStarted = true;
    const shot = name => {
        const stream = Gio.File.new_for_path(`${GLib.getenv('MT_SHOT_DIR')}/${name}.png`).replace(null, false, 0, null);
        new Shell.Screenshot().screenshot(false, stream, (s, r) => { s.screenshot_finish(r); stream.close(null); });
    };
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 9000, () => { Main.overview.hide(); return false; });
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 14000, () => { shot('prefs'); return false; });
};
JS
export MT_SHOT_DIR="${MT_SHOT_DIR:-$ROOT/dist/screenshots}"; mkdir -p "$MT_SHOT_DIR"
# PAGE=tray, PAGE=icons or PAGE=about: open the settings on that page instead (test copy only).
case "${PAGE:-}" in
    tray) sed -i 's/^        window.add(trayPage);$/        window.add(trayPage);\n        window.set_visible_page(trayPage);/' "$EXT/prefs.js" ;;
    icons) sed -i 's/^        window.add(new CustomIconPage(settings, TRAY_KEYS));$/        const iconsPage = new CustomIconPage(settings, TRAY_KEYS);\n        window.add(iconsPage);\n        window.set_visible_page(iconsPage);/' "$EXT/prefs.js" ;;
    about) sed -i 's/^        window.add(this._aboutPage());$/        const about = this._aboutPage(); window.add(about); window.set_visible_page(about); window.set_default_size(720, 1040);/' "$EXT/prefs.js" ;;
esac
