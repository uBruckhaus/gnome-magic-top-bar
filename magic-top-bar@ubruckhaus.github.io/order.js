// Puts the top bar's items in the order of the settings, hides and shows them, and
// adds items new to the settings where GNOME put them.

import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Panel from 'resource:///org/gnome/shell/ui/panel.js';

import {BOXES, TASK_UP_GROUP, TRAY_PREFIX, listKey, mergeOrder} from './items.js';

const userSession = () => Main.sessionMode.currentMode === 'user' || Main.sessionMode.parentMode === 'user';

export class BarOrder {
    constructor(settings, injections, log) {
        this._settings = settings;
        this._injections = injections;
        this._log = log;
    }

    enable() {
        this._applyId = 0;
        this._trayWaits = new Map();   // tray indicator -> 'ready' handler id
        this._forced = new Set();      // containers hidden by the "hidden-items" setting
        const order = this;
        // Items GNOME or other extensions add (or add again after the screen lock).
        this._injections.overrideMethod(Panel.Panel.prototype, '_addToPanelBox', original =>
            function (...args) {
                original.call(this, ...args);
                order.queueApply();
            });
        this._settingsIds = ['left-items', 'center-items', 'right-items', 'hidden-items', 'shown-items']
            .map(key => this._settings.connect(`changed::${key}`, () => this.queueApply()));
        this.apply();
    }

    disable() {
        for (const id of this._settingsIds)
            this._settings.disconnect(id);
        if (this._applyId)
            GLib.source_remove(this._applyId);
        this._applyId = 0;
        for (const [indicator, id] of this._trayWaits)
            indicator.disconnect(id);
        this._trayWaits.clear();
        for (const container of this._forced)
            container.show();
        this._forced.clear();
    }

    boxActor(box) {
        return Main.panel[`_${box}Box`];
    }

    // role -> indicator container, for the items in the bar's boxes.
    containers() {
        const result = new Map();
        for (const [role, indicator] of Object.entries(Main.panel.statusArea)) {
            const container = indicator?.container;
            if (container instanceof St.Bin && BOXES.some(box => container.get_parent() === this.boxActor(box)))
                result.set(role, container);
        }
        return result;
    }

    // The settings id of a role; null for a tray icon that does not know its app yet
    // (it is handled again once it does).
    idOf(role) {
        if (role.startsWith('task-button-'))
            return TASK_UP_GROUP;
        if (!role.startsWith('appindicator-'))
            return role;
        // Legacy (X11) tray icons: "appindicator-legacy:WM_CLASS:PID"; the process id
        // changes with every start.
        const legacy = role.match(/^appindicator-legacy:(.*):\d+$/);
        if (legacy)
            return `${TRAY_PREFIX}${legacy[1]}`;
        const indicator = Main.panel.statusArea[role]?.container?.get_child()?._indicator;
        let app = indicator?.id;
        if (!app) {
            if (indicator && !this._trayWaits.has(indicator)) {
                this._trayWaits.set(indicator, indicator.connect('ready', () => {
                    indicator.disconnect(this._trayWaits.get(indicator));
                    this._trayWaits.delete(indicator);
                    this.queueApply();
                }));
            }
            return null;
        }
        // Dropbox adds its process id.
        if (app.startsWith('dropbox-client-'))
            app = 'dropbox-client';
        return `${TRAY_PREFIX}${app}`;
    }

    lists() {
        return Object.fromEntries(BOXES.map(box => [box, this._settings.get_strv(listKey(box))]));
    }

    saveLists(lists) {
        for (const box of BOXES) {
            const current = this._settings.get_strv(listKey(box));
            if (JSON.stringify(current) !== JSON.stringify(lists[box]))
                this._settings.set_strv(listKey(box), lists[box]);
        }
    }

    // The ids each box shows now, left to right (no duplicates).
    barIds() {
        const roleOf = new Map([...this.containers()].map(([role, container]) => [container, role]));
        return Object.fromEntries(BOXES.map(box => [box, [...new Set(this.boxActor(box).get_children()
            .map(child => roleOf.get(child)).filter(Boolean).map(role => this.idOf(role)).filter(Boolean))]]));
    }

    // After a drag in the bar: the lists become what the bar shows.
    saveFromBar() {
        const bar = this.barIds();
        const inBar = new Set(BOXES.flatMap(box => bar[box]));
        const old = this.lists();
        this.saveLists(Object.fromEntries(BOXES.map(box => [box, mergeOrder(old[box], bar[box], id => inBar.has(id))])));
    }

    queueApply() {
        if (this._applyId)
            return;
        this._applyId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._applyId = 0;
            this.apply();
            return GLib.SOURCE_REMOVE;
        });
    }

    apply() {
        if (!userSession())
            return;
        // Items new to the settings join them: on the left and in the centre at the
        // end, on the right at the start, where GNOME adds new indicators.
        const lists = this.lists();
        const known = new Set(BOXES.flatMap(box => lists[box]));
        const bar = this.barIds();
        for (const box of BOXES) {
            const fresh = bar[box].filter(id => !known.has(id));
            lists[box] = box === 'right' ? [...fresh, ...lists[box]] : [...lists[box], ...fresh];
        }
        this.saveLists(lists);

        const rolesOf = new Map();
        for (const [role, container] of this.containers()) {
            const id = this.idOf(role);
            if (id)
                rolesOf.set(id, [...rolesOf.get(id) ?? [], container]);
        }
        const hidden = new Set(this._settings.get_strv('hidden-items'));
        const shown = new Set(this._settings.get_strv('shown-items'));
        for (const box of BOXES) {
            const actor = this.boxActor(box);
            const containers = lists[box].flatMap(id => rolesOf.get(id) ?? []);
            // Known items first on the left and in the centre; on the right they end
            // the box, so items still unknown (tray icons starting) wait at its left.
            containers.forEach((container, i) => {
                const index = box === 'right' ? actor.get_n_children() - containers.length + i : i;
                if (container.get_parent() === actor && actor.get_child_at_index(index) === container)
                    return;
                container.get_parent()?.remove_child(container);
                actor.insert_child_at_index(container, box === 'right' ? -1 : index);
            });
        }
        for (const [id, containers] of rolesOf) {
            for (const container of containers) {
                if (hidden.has(id)) {
                    container.hide();
                    this._forced.add(container);
                } else if (shown.has(id)) {
                    container.show();
                } else if (this._forced.delete(container)) {
                    container.show();
                }
            }
        }
        this._log(`order: ${BOXES.map(box => `${box} [${this.barIds()[box].join(', ')}]`).join(' ')}`);
    }
}
