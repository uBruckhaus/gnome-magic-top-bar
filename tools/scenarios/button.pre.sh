# The settings button: a click opens the settings, a drag only moves the button, and a
# click after the drag opens them again. Test-only patch: openPreferences() only counts.
cat >> "$EXT/extension.js" <<'JS'
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
const _origEnable = MagicTopBarExtension.prototype.enable;
MagicTopBarExtension.prototype.enable = function () {
    this.openPreferences = () => { this._opened = (this._opened ?? 0) + 1; };
    _origEnable.call(this);
    if (this._testStarted)
        return;
    this._testStarted = true;
    const seat = global.stage.context.get_backend().get_default_seat();
    const ptr = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    const now = () => GLib.get_monotonic_time();
    const log = m => console.log(`[Magic Top Bar] TEST ${m}`);
    const at = (ms, fn) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { try { fn(); } catch (e) { log(`error ${e}\n${e.stack}`); } return false; });
    const role = this.uuid;
    const centre = () => { const c = Main.panel.statusArea[role].container; const [x, y] = c.get_transformed_position(); const [w, h] = c.get_transformed_size(); return [x + w / 2, y + h / 2]; };
    const move = (x, y) => ptr.notify_absolute_motion(now(), x, y);
    const button = down => ptr.notify_button(now(), Clutter.BUTTON_PRIMARY, down ? Clutter.ButtonState.PRESSED : Clutter.ButtonState.RELEASED);
    const opened = () => this._opened ?? 0;
    at(500, () => { move(960, 600); Main.overview.hide(); });
    at(2000, () => log(`button in bar: ${Boolean(Main.panel.statusArea[role]?.container.get_parent())}, ` +
        `right-items [${this._settings.get_strv('right-items').join(', ')}]`));
    at(3000, () => move(...centre()));
    at(3200, () => button(true));
    at(3260, () => button(false));
    at(4000, () => log(`after click: opened ${opened()}`));
    at(5000, () => { this._p = centre(); move(...this._p); });
    at(5200, () => button(true));
    for (let i = 1; i <= 6; i++)
        at(5300 + i * 60, () => move(this._p[0] - 300 * i / 6, this._p[1]));
    at(5900, () => button(false));
    at(6600, () => log(`after drag: opened ${opened()}, right-items [${this._settings.get_strv('right-items').join(', ')}]`));
    at(7000, () => move(...centre()));
    at(7200, () => button(true));
    at(7260, () => button(false));
    at(8000, () => log(`after click: opened ${opened()}`));
};
JS
