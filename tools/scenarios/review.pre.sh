# The review fixes (test-only patch): an item of another extension goes back where it was
# when Magic Top Bar is disabled; "Always shown" gives a hidden button its own visibility
# back; the tray's watcher is created in enable and gone after disable.
$S set org.gnome.shell.extensions.magic-top-bar right-items "['test-other', 'quickSettings']"
$S set org.gnome.shell.extensions.magic-top-bar shown-items "['test-other']"
cat >> "$EXT/extension.js" <<'JS'
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
const log = m => console.log(`[Magic Top Bar] TEST ${m}`);
const where = c => { const p = c.get_parent(); const box = ['left', 'center', 'right'].find(b => Main.panel[`_${b}Box`] === p); return `${box ?? '?'}#${p?.get_children().indexOf(c)}`; };
let other = null;
const _origEnable = MagicTopBarExtension.prototype.enable;
MagicTopBarExtension.prototype.enable = function () {
    if (!other) {
        // "Another extension": its button, hidden by its owner, second on the left.
        other = new PanelMenu.Button(0.5, 'other');
        other.add_child(new St.Label({text: 'OTHER'}));
        Main.panel.addToStatusArea('test-other', other, 1, 'left');
        other.hide();
        log(`other before Magic Top Bar: ${where(other.container)} visible=${other.visible}`);
    }
    _origEnable.call(this);
    if (this._testStarted) {
        log(`re-enabled: other ${where(other.container)}, watcher=${Boolean(this._tray._watchDog)}`);
        return;
    }
    this._testStarted = true;
    const at = (ms, fn) => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { try { fn(); } catch (e) { log(`error ${e}\n${e.stack}`); } return false; });
    at(2000, () => log(`with Magic Top Bar: other ${where(other.container)} visible=${other.visible} (always shown), watcher=${Boolean(this._tray._watchDog)}`));
    at(2500, () => { other.hide(); log(`owner hides it while always shown: visible=${other.visible}`); });
    at(3000, () => this._settings.set_strv('shown-items', []));
    at(3500, () => log(`always shown ended: visible=${other.visible} (owner wanted false)`));
    at(4000, () => this._settings.set_strv('shown-items', ['test-other']));
};
const _origDisable = MagicTopBarExtension.prototype.disable;
MagicTopBarExtension.prototype.disable = function () {
    _origDisable.call(this);
    log(`after disable: other ${where(other.container)} visible=${other.visible}, watcher=${this._tray._watchDog}`);
};
JS
