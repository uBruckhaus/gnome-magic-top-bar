# After dragging an item, a click on that same item must still work (the drag ends
# with its release kept from the item). Test-only patch.
cat >> "$EXT/extension.js" <<'JS'
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
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
    const centre = role => { const c = Main.panel.statusArea[role].container; const [x, y] = c.get_transformed_position(); const [w, h] = c.get_transformed_size(); return [x + w / 2, y + h / 2]; };
    const move = (x, y) => ptr.notify_absolute_motion(now(), x, y);
    const button = down => ptr.notify_button(now(), Clutter.BUTTON_PRIMARY, down ? Clutter.ButtonState.PRESSED : Clutter.ButtonState.RELEASED);
    const drag = (ms, role, dx) => {
        at(ms, () => { const [x, y] = centre(role); this._p = [x, y]; move(x, y); });
        at(ms + 200, () => button(true));
        for (let i = 1; i <= 6; i++)
            at(ms + 300 + i * 60, () => move(this._p[0] + dx * i / 6, this._p[1]));
        at(ms + 900, () => button(false));
    };
    const click = (ms, role, what) => {
        at(ms, () => { const [x, y] = centre(role); move(x, y); });
        at(ms + 200, () => button(true));
        at(ms + 260, () => button(false));
        at(ms + 1200, () => log(`click on ${role} after its drag: ${what()}`));
    };
    at(500, () => { move(960, 600); Main.overview.hide(); });
    // Dragged a little, staying in its own place: the case of the review.
    drag(3000, 'activities', 30);
    click(5000, 'activities', () => `overview=${Main.overview.visible}`);
    at(7000, () => Main.overview.hide());
    drag(9000, 'quickSettings', -30);
    click(11000, 'quickSettings', () => `menu open=${Main.panel.statusArea.quickSettings.menu.isOpen}`);
    at(12500, () => Main.panel.menuManager.activeMenu?.close());
    drag(13000, 'dateMenu', -400);
    click(15000, 'dateMenu', () => `menu open=${Main.panel.statusArea.dateMenu.menu.isOpen}`);
    // Dragged away and back over its old place, then dropped onto the box next to it.
    drag(17000, 'activities', 1500);
    click(19000, 'activities', () => `overview=${Main.overview.visible}`);
};
JS
