// Tray icons: AppIndicator, KStatusNotifierItem and legacy (X11) tray icons in the
// bar, with their menus. The work is done by the code in tray/ (see tray/README.md);
// this starts and stops it the way its own extension did.
//
// That code expects its own extension object: it gets one that points to tray/ and
// shares Magic Top Bar's settings.

import * as StatusNotifierWatcher from './tray/statusNotifierWatcher.js';
import * as Interfaces from './tray/interfaces.js';
import * as TrayIconsManager from './tray/trayIconsManager.js';
import * as Util from './tray/util.js';
import {Logger} from './tray/logger.js';
import {SettingsManager} from './tray/settingsManager.js';

export class TrayIcons {
    constructor(extension) {
        this._host = {
            dir: extension.dir.get_child('tray'),
            path: extension.dir.get_child('tray').get_path(),
            metadata: extension.metadata,
            getSettings: () => extension.getSettings(),
        };
        Logger.init(this._host);
        Interfaces.initialize(this._host);

        this._enabled = false;
        this._watcher = null;
        // GNOME Shell may disable and enable extensions quickly (the screen lock); the
        // watcher's bus name is taken again only once the old one is gone, so this
        // watch outlives disable().
        this._watchDog = new Util.NameWatcher(StatusNotifierWatcher.WATCHER_BUS_NAME);
        this._watchDogId = this._watchDog.connect('vanished', () => this._startWatcher());
    }

    enable() {
        this._enabled = true;
        SettingsManager.initialize(this._host);
        Util.tryCleanupOldIndicators();
        this._startWatcher();
        TrayIconsManager.TrayIconsManager.initialize();
    }

    disable() {
        this._enabled = false;
        TrayIconsManager.TrayIconsManager.destroy();
        this._watcher?.destroy();
        this._watcher = null;
        SettingsManager.destroy();
    }

    _startWatcher() {
        if (!this._enabled || this._watcher)
            return;
        if (this._watchDog.nameAcquired && this._watchDog.nameOnBus)
            return;
        this._watcher = new StatusNotifierWatcher.StatusNotifierWatcher(this._host, this._watchDog);
    }
}
