// Magic Top Bar: the top bar's items in the order of the settings, dragged around in
// the bar itself, a background that a double-click makes transparent, and tray icons.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

import {BarDrag} from './barDrag.js';
import {BarOrder} from './order.js';
import {TrayIcons} from './tray.js';

export default class MagicTopBarExtension extends Extension {
    constructor(...args) {
        super(...args);
        this._tray = new TrayIcons(this);
    }

    enable() {
        this._settings = this.getSettings();
        const log = message => {
            if (this._settings.get_boolean('debug'))
                console.log(`[Magic Top Bar] ${message}`);
        };
        this._injections = new InjectionManager();
        this._order = new BarOrder(this._settings, this._injections, log);
        this._order.enable();
        this._drag = new BarDrag(this._settings, this._order, log);
        this._drag.enable();
        Main.panel.add_style_class_name('magic-top-bar');
        this._transparentId = this._settings.connect('changed::transparent', () => this._syncTransparency());
        this._syncTransparency();
        this._tray.enable();
    }

    disable() {
        this._tray.disable();
        this._settings.disconnect(this._transparentId);
        Main.panel.remove_style_class_name('magic-top-bar-transparent');
        Main.panel.remove_style_class_name('magic-top-bar');
        this._drag.disable();
        this._order.disable();
        this._injections.clear();
        this._drag = this._order = this._injections = this._settings = null;
    }

    _syncTransparency() {
        if (this._settings.get_boolean('transparent'))
            Main.panel.add_style_class_name('magic-top-bar-transparent');
        else
            Main.panel.remove_style_class_name('magic-top-bar-transparent');
    }
}
