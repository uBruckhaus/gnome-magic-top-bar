# Tray icons (test-only patch): a status notifier item with a menu (tests/tray-app,
# from the AppIndicator extension's test tools) shows up in the bar, joins the item
# lists as "appindicator:reorder-test-tool", opens its menu on a click, can be
# dragged, and keeps its place after disable / enable.
cat >> "$EXT/extension.js" <<'JS'
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
const _origEnable = MagicTopBarExtension.prototype.enable;
MagicTopBarExtension.prototype.enable = function () {
    _origEnable.call(this);
    const log = m => console.log(`[Magic Top Bar] TEST ${m}`);
    const at = (ms, fn) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { try { fn(); } catch (e) { log(`error ${e}\n${e.stack}`); } return false; });
    const trayRole = () => Object.keys(Main.panel.statusArea).find(r => r.startsWith('appindicator-'));
    const bar = () => ['left', 'center', 'right'].map(b => `${b}[${Main.panel[`_${b}Box`].get_children().filter(c => c.visible).map(c => { const r = Object.keys(Main.panel.statusArea).find(k => Main.panel.statusArea[k]?.container === c); return r?.startsWith('appindicator-') ? 'TRAY' : r ?? '?'; }).join(',')}]`).join(' ');
    if (this._testStarted) {
        at(3000, () => log(`after re-enable: tray role=${trayRole()} ${bar()}`));
        return;
    }
    this._testStarted = true;
    const seat = global.stage.context.get_backend().get_default_seat();
    const ptr = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    const now = () => GLib.get_monotonic_time();
    const move = (x, y) => ptr.notify_absolute_motion(now(), x, y);
    const button = down => ptr.notify_button(now(), Clutter.BUTTON_PRIMARY, down ? Clutter.ButtonState.PRESSED : Clutter.ButtonState.RELEASED);
    const centre = role => { const c = Main.panel.statusArea[role].container; const [x, y] = c.get_transformed_position(); const [w, h] = c.get_transformed_size(); return [x + w / 2, y + h / 2]; };
    const shot = name => {
        const stream = Gio.File.new_for_path(`${GLib.getenv('MT_SHOT_DIR')}/${name}.png`).replace(null, false, 0, null);
        new Shell.Screenshot().screenshot(false, stream, (s, r) => { s.screenshot_finish(r); stream.close(null); });
    };
    at(500, () => { move(960, 600); Main.overview.hide(); });
    at(9000, () => {
        const role = trayRole();
        const icon = Main.panel.statusArea[role];
        log(`tray role=${role} id=${icon?._indicator?.id} visible=${icon?.container.visible} ${bar()}`);
        log(`saved right=${this._settings.get_strv('right-items')}`);
    });
    at(9500, () => { const [x, y] = centre(trayRole()); move(x, y); });
    at(9700, () => button(true));
    at(9750, () => button(false));
    at(11000, () => {
        const menu = Main.panel.statusArea[trayRole()].menu;
        log(`click: menu open=${menu.isOpen} items=${menu._getMenuItems().map(i => i.label?.text ?? '-').join('|')}`);
        shot('tray-menu');
    });
    at(11500, () => Main.panel.menuManager.activeMenu?.close());
    // Drag the tray icon to the left side.
    at(12000, () => { const [x, y] = centre(trayRole()); this._p = [x, y]; move(x, y); });
    at(12200, () => button(true));
    for (let i = 1; i <= 10; i++)
        at(12300 + i * 60, () => move(this._p[0] + (200 - this._p[0]) * i / 10, this._p[1]));
    at(13100, () => button(false));
    at(13600, () => log(`after drag: ${bar()} saved left=${this._settings.get_strv('left-items')} overview=${Main.overview.visible}`));
    at(14000, () => shot('tray-dragged'));
};
JS
export MT_SHOT_DIR="${MT_SHOT_DIR:-$ROOT/dist/screenshots}"; mkdir -p "$MT_SHOT_DIR"
