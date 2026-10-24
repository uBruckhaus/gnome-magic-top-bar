// Item ids shared by the extension and its settings. An item's id is its role in the
// top bar (the name it was added under), except for groups of roles that belong to
// one app and change from session to session.

export const BOXES = ['left', 'center', 'right'];
export const TRAY_PREFIX = 'appindicator:';
// Task Up UltraLite adds a top bar item per window; they move as one.
export const TASK_UP_GROUP = 'group:task-up-ultralite';

export const listKey = box => `${box}-items`;

// GNOME's own items.
const BUILT_IN = {
    activities: 'Activities',
    appMenu: 'App menu',
    dateMenu: 'Clock and calendar',
    quickSettings: 'System menu',
    a11y: 'Accessibility',
    keyboard: 'Keyboard layout',
    dwellClick: 'Dwell click',
    screenRecording: 'Screen recording',
    screenSharing: 'Screen sharing',
};

// A readable name; extension items are named by their extension (uuid -> name).
export function itemName(id, extensionNames = new Map()) {
    if (BUILT_IN[id])
        return BUILT_IN[id];
    if (id.startsWith(TRAY_PREFIX))
        return `Tray icon: ${id.slice(TRAY_PREFIX.length)}`;
    if (id === TASK_UP_GROUP)
        return 'Task Up UltraLite windows';
    return extensionNames.get(id) ?? id;
}

// The lists after moving `id` to `index` of `box` (taken out of whichever list it was in).
export function moveItem(lists, id, box, index) {
    const result = Object.fromEntries(BOXES.map(b => [b, [...lists[b]]]));
    for (const b of BOXES) {
        const at = result[b].indexOf(id);
        if (at < 0)
            continue;
        result[b].splice(at, 1);
        if (b === box && at < index)
            index--;
    }
    result[box].splice(Math.max(0, Math.min(index, result[box].length)), 0, id);
    return result;
}

// A box's list after the bar showed `present` (its items now, left to right): items
// not in the bar at all (`inBar` tells) keep their place after the item they
// followed before.
export function mergeOrder(old, present, inBar) {
    const result = [...present];
    old.forEach((id, i) => {
        if (inBar(id) || result.includes(id))
            return;
        const before = old.slice(0, i).reverse().find(other => result.includes(other));
        result.splice(before === undefined ? 0 : result.indexOf(before) + 1, 0, id);
    });
    return result;
}
