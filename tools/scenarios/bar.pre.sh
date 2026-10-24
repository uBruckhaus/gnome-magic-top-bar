# Order from the settings, dragging items with a virtual pointer, the double-click
# transparency (test-only patch), with a maximized window under the bar.
$S set org.gnome.shell.extensions.magic-top-bar right-items "['activities', 'quickSettings']"
cat >> "$EXT/extension.js" <<'JS'
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
const _origEnable = MagicTopBarExtension.prototype.enable;
MagicTopBarExtension.prototype.enable = function () {
    _origEnable.call(this);
    if (this._testStarted)
        return;
    this._testStarted = true;
    const seat = global.stage.context.get_backend().get_default_seat();
    const ptr = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    const now = () => GLib.get_monotonic_time();
    const log = m => console.log(`[Magic Top Bar] TEST ${m}`);
    const at = (ms, fn) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { try { fn(); } catch (e) { log(`error ${e}\n${e.stack}`); } return false; });
    const shot = name => {
        const stream = Gio.File.new_for_path(`${GLib.getenv('MT_SHOT_DIR')}/${name}.png`).replace(null, false, 0, null);
        new Shell.Screenshot().screenshot(false, stream, (s, r) => { s.screenshot_finish(r); stream.close(null); });
    };
    const centre = role => { const c = Main.panel.statusArea[role].container; const [x, y] = c.get_transformed_position(); const [w, h] = c.get_transformed_size(); return [x + w / 2, y + h / 2]; };
    const bar = () => ['left', 'center', 'right'].map(b => `${b}[${Main.panel[`_${b}Box`].get_children().map(c => Object.keys(Main.panel.statusArea).find(r => Main.panel.statusArea[r].container === c) ?? '?').join(',')}]`).join(' ');
    const move = (x, y) => ptr.notify_absolute_motion(now(), x, y);
    const button = down => ptr.notify_button(now(), Clutter.BUTTON_PRIMARY, down ? Clutter.ButtonState.PRESSED : Clutter.ButtonState.RELEASED);
    // Press on `role`, move in steps to x, release.
    const drag = (ms, role, toX) => {
        at(ms, () => { const [x, y] = centre(role); this._p = [x, y]; move(x, y); });
        at(ms + 200, () => button(true));
        for (let i = 1; i <= 10; i++)
            at(ms + 300 + i * 60, () => move(this._p[0] + (toX - this._p[0]) * i / 10, this._p[1]));
        at(ms + 1100, () => log(`while dragging ${role}: menu open=${Boolean(Main.panel.menuManager.activeMenu)} bar ${bar()}`));
        at(ms + 1200, () => button(false));
        at(ms + 1600, () => log(`after dragging ${role}: ${bar()} overview=${Main.overview.visible} menu open=${Boolean(Main.panel.menuManager.activeMenu)} opacity=${Main.panel.statusArea[role].container.opacity}`));
    };
    at(500, () => { move(960, 600); Main.overview.hide(); });
    at(2500, () => log(`start: ${bar()} saved right=${this._settings.get_strv('right-items')}`));
    at(3000, () => shot('1-start'));
    drag(3500, 'dateMenu', 1700);
    at(5500, () => shot('2-clock-dragged-right'));
    drag(6000, 'activities', 300);
    // A plain click still opens a menu.
    at(8500, () => { const [x, y] = centre('quickSettings'); move(x, y); });
    at(8700, () => button(true));
    at(8750, () => button(false));
    at(9300, () => { log(`click on quickSettings: menu open=${Main.panel.menuManager.activeMenu === Main.panel.statusArea.quickSettings.menu}`); Main.panel.menuManager.activeMenu?.close(); });
    // Double-click on the empty bar (a maximized window under it).
    const dbl = ms => {
        at(ms, () => move(700, 10));
        for (const [d, down] of [[200, true], [240, false], [320, true], [360, false]])
            at(ms + d, () => button(down));
    };
    at(9500, () => { const w = global.display.list_all_windows().find(w => w.get_window_type() === 0); w?.activate(global.get_current_time()); w?.maximize(); });
    dbl(10000);
    at(11000, () => { const w = global.display.focus_window; const f = w?.get_frame_rect(); log(`after double-click: transparent=${this._settings.get_boolean('transparent')} class=${Main.panel.has_style_class_name('magic-top-bar-transparent')} window=${w?.get_title()} ${f?.x},${f?.y} ${f?.width}x${f?.height} max=${w?.get_maximize_flags()}`); });
    at(11500, () => shot('3-transparent'));
    dbl(12000);
    at(13000, () => log(`after second double-click: transparent=${this._settings.get_boolean('transparent')} class=${Main.panel.has_style_class_name('magic-top-bar-transparent')}`));
    at(13300, () => log(`saved: left=${this._settings.get_strv('left-items')} center=${this._settings.get_strv('center-items')} right=${this._settings.get_strv('right-items')}`));
};
JS
export MT_SHOT_DIR="${MT_SHOT_DIR:-$ROOT/dist/screenshots}"; mkdir -p "$MT_SHOT_DIR"
