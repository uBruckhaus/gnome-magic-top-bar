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
        this._enabled = false;
        this._watcher = null;
        this._watchDog = null;
    }

    enable() {
        this._enabled = true;
        Interfaces.initialize();
        SettingsManager.initialize(this._host);
        Util.tryCleanupOldIndicators();
        // The watcher's bus name may still be held by the one just destroyed (GNOME
        // disables and enables extensions quickly around the screen lock): it starts
        // once the name is free.
        this._watchDog = new Util.NameWatcher(StatusNotifierWatcher.WATCHER_BUS_NAME);
        this._watchDogId = this._watchDog.connect('vanished', () => this._startWatcher());
        this._startWatcher();
        TrayIconsManager.TrayIconsManager.initialize();
    }

    disable() {
        this._enabled = false;
        TrayIconsManager.TrayIconsManager.destroy();
        this._watcher?.destroy();
        this._watcher = null;
        this._watchDog.disconnect(this._watchDogId);
        this._watchDog.destroy();
        this._watchDog = null;
        SettingsManager.destroy();
        Interfaces.destroy();
    }

    _startWatcher() {
        if (!this._enabled || this._watcher)
            return;
        if (this._watchDog.nameAcquired && this._watchDog.nameOnBus)
            return;
        this._watcher = new StatusNotifierWatcher.StatusNotifierWatcher(this._host, this._watchDog);
    }
}
