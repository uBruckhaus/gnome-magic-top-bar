// Mouse handling in the bar itself: a double-click on its empty background switches
// the background between transparent and normal, and an item dragged with the left
// button held moves to where it is dropped, also to another side of the bar.
//
// A press on an item opens its menu at once, and the open menu takes all input, so
// this works with an event filter, which sees every event first: the press goes on
// to the item as usual; when the pointer then moves far enough with the button
// still held, the menu closes and the drag begins.

import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {BOXES} from './items.js';

export class BarDrag {
    constructor(settings, order, log) {
        this._settings = settings;
        this._order = order;
        this._log = log;
    }

    enable() {
        this._press = null;        // {container, x, y}: left button down on an item
        this._drag = null;         // {container, clone, dx, dy}
        this._lastClick = null;    // {time, x, y}: the last press on the empty bar
        this._filterId = Clutter.event_add_filter(global.stage, event => this._onEvent(event));
    }

    disable() {
        Clutter.event_remove_filter(this._filterId);
        this._filterId = 0;
        this._endDrag(false);
        this._forgetPress();
    }

    // The pressed item went away (its app quit, its window closed): no drag.
    _watch(container) {
        container.connectObject('destroy', () => {
            this._press = null;
            if (this._drag?.container === container) {
                this._drag.container = null;
                this._endDrag(false);
            }
        }, this);
    }

    _forgetPress() {
        if (this._press && this._press.container !== this._drag?.container)
            this._press.container.disconnectObject(this);
        this._press = null;
    }

    get dragging() {
        return this._drag !== null;
    }

    _boxes() {
        return BOXES.map(box => this._order.boxActor(box));
    }

    // The actor at a point of the bar, or null outside it.
    _panelActorAt(x, y) {
        const panel = Main.panel;
        if (!panel.mapped)
            return null;
        const [px, py] = panel.get_transformed_position();
        const [width, height] = panel.get_transformed_size();
        if (x < px || x >= px + width || y < py || y >= py + height)
            return null;
        const actor = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
        return actor && panel.contains(actor) ? actor : null;
    }

    // The item container (a child of one of the three boxes) an actor belongs to.
    _containerOf(actor) {
        const boxes = this._boxes();
        while (actor && !boxes.includes(actor.get_parent()))
            actor = actor.get_parent();
        return actor instanceof St.Bin ? actor : null;
    }

    _onEvent(event) {
        const type = event.type();
        if (type === Clutter.EventType.BUTTON_PRESS && event.get_button() === Clutter.BUTTON_PRIMARY)
            return this._onPress(event);
        if (type === Clutter.EventType.MOTION)
            return this._onMotion(event);
        if (type === Clutter.EventType.BUTTON_RELEASE && event.get_button() === Clutter.BUTTON_PRIMARY)
            return this._onRelease();
        return Clutter.EVENT_PROPAGATE;
    }

    _onPress(event) {
        this._forgetPress();
        const [x, y] = event.get_coords();
        // Another menu or dialog has the input (a press in the bar then only closes it).
        const actor = Main.modalCount > 0 && !Main.panel.menuManager.activeMenu ? null : this._panelActorAt(x, y);
        if (!actor)
            return Clutter.EVENT_PROPAGATE;
        if (this._boxes().includes(actor) || actor === Main.panel)
            return this._onBackgroundPress(event, x, y);
        this._lastClick = null;
        const container = this._containerOf(actor);
        if (container && this._settings.get_boolean('drag-items')) {
            this._press = {container, x, y};
            this._watch(container);
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onBackgroundPress(event, x, y) {
        if (!this._settings.get_boolean('double-click-transparency'))
            return Clutter.EVENT_PROPAGATE;
        const clutter = global.stage.context.get_settings();
        const last = this._lastClick;
        const time = event.get_time();
        if (last && time - last.time <= clutter.double_click_time &&
            Math.abs(x - last.x) <= clutter.double_click_distance && Math.abs(y - last.y) <= clutter.double_click_distance) {
            this._lastClick = null;
            this._settings.set_boolean('transparent', !this._settings.get_boolean('transparent'));
            this._log(`double-click: transparent ${this._settings.get_boolean('transparent')}`);
            // Not on to the bar: its own press would start dragging a maximized window.
            return Clutter.EVENT_STOP;
        }
        this._lastClick = {time, x, y};
        return Clutter.EVENT_PROPAGATE;
    }

    _onMotion(event) {
        const [x, y] = event.get_coords();
        if (this._drag) {
            this._drag.clone.set_position(Math.round(x - this._drag.dx), Math.round(y - this._drag.dy));
            this._moveTo(x);
            return Clutter.EVENT_STOP;
        }
        if (!this._press)
            return Clutter.EVENT_PROPAGATE;
        if (!(event.get_state() & Clutter.ModifierType.BUTTON1_MASK)) {
            this._forgetPress();
            return Clutter.EVENT_PROPAGATE;
        }
        const threshold = St.Settings.get().drag_threshold;
        if (Math.abs(x - this._press.x) < threshold && Math.abs(y - this._press.y) < threshold)
            return Clutter.EVENT_PROPAGATE;
        const {container, x: pressX, y: pressY} = this._press;
        this._press = null;   // The drag watches the item from now on.
        this._beginDrag(container, pressX, pressY);
        return Clutter.EVENT_STOP;
    }

    _onRelease() {
        this._forgetPress();
        if (!this._drag)
            return Clutter.EVENT_PROPAGATE;
        this._endDrag(true);
        return Clutter.EVENT_STOP;
    }

    _beginDrag(container, x, y) {
        // The press opened the item's menu and started its click gestures: the drag
        // replaces both, so the release does not count as a click.
        Main.panel.menuManager.activeMenu?.close();
        const cancelGestures = actor => {
            for (const action of actor.get_actions())
                if (action instanceof Clutter.Gesture)
                    action.cancel();
            for (const child of actor.get_children())
                cancelGestures(child);
        };
        cancelGestures(container);
        const [cx, cy] = container.get_transformed_position();
        // The item under the pointer, lit up; its own place stays empty in the bar.
        const clone = new St.Bin({
            style_class: 'magic-top-bar-drag',
            child: new Clutter.Clone({source: container}),
        });
        Main.layoutManager.uiGroup.add_child(clone);
        clone.set_position(Math.round(cx), Math.round(cy));
        container.opacity = 0;
        container.get_child()?.sync_hover?.();
        this._drag = {container, clone, dx: x - cx, dy: y - cy};
        this._log(`drag: begin at ${Math.round(x)}`);
    }

    _endDrag(drop) {
        const drag = this._drag;
        if (!drag)
            return;
        this._drag = null;
        drag.clone.destroy();
        if (!drag.container)
            return;   // Destroyed while dragged.
        drag.container.disconnectObject(this);
        drag.container.opacity = 255;
        if (drop) {
            this._order.saveFromBar(drag.container);
            this._log(`drag: dropped, ${BOXES.map(box => `${box} [${this._order.lists()[box].join(', ')}]`).join(' ')}`);
        }
    }

    // Moves the dragged item to the box and place the pointer is over: before the
    // first item whose middle is right of the pointer. The bar's free space between
    // two boxes is split in the middle.
    _moveTo(x) {
        const container = this._drag.container;
        const boxes = this._boxes();
        const edges = boxes.map(box => {
            const [bx] = box.get_transformed_position();
            const [width] = box.get_transformed_size();
            return [bx, bx + width];
        });
        const box = x < (edges[0][1] + edges[1][0]) / 2 ? boxes[0]
            : x < (edges[1][1] + edges[2][0]) / 2 ? boxes[1] : boxes[2];
        const others = box.get_children().filter(child => child !== container);
        const before = others.find(child => {
            if (!child.visible)
                return false;
            const [childX] = child.get_transformed_position();
            const [width] = child.get_transformed_size();
            return childX + width / 2 > x;
        });
        const index = before ? others.indexOf(before) : others.length;
        if (container.get_parent() === box && box.get_children().indexOf(container) === index)
            return;
        container.get_parent().remove_child(container);
        box.insert_child_at_index(container, index);
    }
}
