// A button in the bar that opens the settings. It is an item like any other: it can be
// dragged, moved in the settings or hidden there.
//
// It opens on release, through a click gesture: a drag in the bar cancels the item's
// gestures (see barDrag.js), so dragging the button does not open the settings.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

export class SettingsButton {
    constructor(extension) {
        this._extension = extension;
    }

    enable() {
        this._button = new PanelMenu.Button(0.5, this._extension.metadata.name, true);
        this._button.add_child(new St.Icon({
            icon_name: 'preferences-desktop-appearance-symbolic',
            style_class: 'system-status-icon',
        }));
        const click = new Clutter.ClickGesture();
        click.connect('recognize', () => this._extension.openPreferences());
        this._button.add_action(click);
        Main.panel.addToStatusArea(this._extension.uuid, this._button, 0, 'right');
    }

    disable() {
        this._button.destroy();
        this._button = null;
    }
}
