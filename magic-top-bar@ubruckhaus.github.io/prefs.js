// Settings: the bar's switches, and its items as three lists (left, centre, right)
// whose rows can be dragged within a list and between lists.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {BOXES, itemName, listKey, moveItem} from './items.js';
import {CustomIconPage} from './tray/preferences/customIconPage.js';
import {GeneralPage} from './tray/preferences/generalPage.js';

// The tray pages' settings (the AppIndicator extension's keys).
const TRAY_KEYS = {
    LEGACY_TRAY_ENABLED: 'legacy-tray-enabled',
    COMPACT_MODE_ENABLED: 'compact-mode-enabled',
    ICON_SIZE: 'icon-size',
    ICON_OPACITY: 'icon-opacity',
    ICON_SATURATION: 'icon-saturation',
    ICON_BRIGHTNESS: 'icon-brightness',
    ICON_CONTRAST: 'icon-contrast',
    CUSTOM_ICONS: 'custom-icons',
};

const BOX_TITLES = {left: 'Left', center: 'Centre', right: 'Right'};
const VISIBILITY = ['Default', 'Hidden', 'Always shown'];

// Changes to the lists rebuild the rows, so a row's own handlers change them a moment later.
function later(run) {
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        run();
        return GLib.SOURCE_REMOVE;
    });
}

// uuid -> name of the installed extensions, for the items they add.
function extensionNames() {
    try {
        const reply = Gio.DBus.session.call_sync('org.gnome.Shell', '/org/gnome/Shell',
            'org.gnome.Shell.Extensions', 'ListExtensions', null, new GLib.VariantType('(a{sa{sv}})'),
            Gio.DBusCallFlags.NONE, 2000, null);
        const [extensions] = reply.recursiveUnpack();
        return new Map(Object.entries(extensions).map(([uuid, info]) => [uuid, info.name ?? uuid]));
    } catch {
        return new Map();
    }
}

export default class MagicTopBarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(640, 860);
        const page = new Adw.PreferencesPage({title: 'Top Bar', icon_name: 'view-grid-symbolic'});
        window.add(page);

        const bar = new Adw.PreferencesGroup({title: 'Bar'});
        for (const [key, title, subtitle] of [
            ['transparent', 'Transparent background', null],
            ['double-click-transparency', 'Double-click switches transparency',
                'A double-click on the empty bar makes its background transparent, the next one normal again'],
            ['drag-items', 'Drag items in the bar',
                'Hold the left mouse button on an item and move it to another place or another side'],
        ]) {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            bar.add(row);
        }
        page.add(bar);

        const names = extensionNames();
        const read = () => Object.fromEntries(BOXES.map(box => [box, settings.get_strv(listKey(box))]));
        const save = result => {
            for (const box of BOXES)
                settings.set_strv(listKey(box), result[box]);
        };
        const move = (id, box, index) => save(moveItem(read(), id, box, index));
        const forget = id => save(Object.fromEntries(BOXES.map(box => [box, read()[box].filter(other => other !== id)])));
        // One step up or down; past the end of a list into the next one.
        const step = (id, box, delta) => {
            const current = read();
            const index = current[box].indexOf(id);
            const next = BOXES[BOXES.indexOf(box) + delta];
            if (index + delta < 0)
                move(id, next, Infinity);
            else if (index + delta >= current[box].length)
                move(id, next, 0);
            else
                move(id, box, index + (delta > 0 ? 2 : -1));
        };
        const visibilityOf = id => settings.get_strv('hidden-items').includes(id) ? 1
            : settings.get_strv('shown-items').includes(id) ? 2 : 0;
        const setVisibility = (id, choice) => {
            for (const [key, value] of [['hidden-items', 1], ['shown-items', 2]]) {
                const others = settings.get_strv(key).filter(other => other !== id);
                settings.set_strv(key, choice === value ? [...others, id] : others);
            }
        };

        const listBoxes = {};
        for (const box of BOXES) {
            const group = new Adw.PreferencesGroup({
                title: BOX_TITLES[box],
                description: box === 'left'
                    ? 'Drag the rows to put the items in another order or on another side. Items that are not in the bar right now keep their place.'
                    : null,
            });
            const listBox = new Gtk.ListBox({selection_mode: Gtk.SelectionMode.NONE, css_classes: ['boxed-list']});
            listBox.set_placeholder(new Gtk.Label({label: 'No items: drop one here', css_classes: ['dim-label'], margin_top: 12, margin_bottom: 12}));
            // Dropped on the list itself (empty, or below its rows): to its end.
            const target = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE);
            target.connect('drop', (_target, id) => {
                later(() => move(id, box, Infinity));
                return true;
            });
            listBox.add_controller(target);
            group.add(listBox);
            page.add(group);
            listBoxes[box] = listBox;
        }

        const makeRow = (id, box, index, count) => {
            const row = new Adw.ActionRow({title: itemName(id, names), subtitle: itemName(id, names) === id ? '' : id});
            row.add_prefix(new Gtk.Image({icon_name: 'list-drag-handle-symbolic'}));

            const visibility = Gtk.DropDown.new_from_strings(VISIBILITY);
            visibility.valign = Gtk.Align.CENTER;
            visibility.selected = visibilityOf(id);
            visibility.tooltip_text = 'Visibility';
            visibility.connect('notify::selected', () => setVisibility(id, visibility.selected));
            row.add_suffix(visibility);

            const actions = new Gio.SimpleActionGroup();
            for (const [name, run, enabled] of [
                ['move-up', () => step(id, box, -1), !(box === 'left' && index === 0)],
                ['move-down', () => step(id, box, 1), !(box === 'right' && index === count - 1)],
                ['forget', () => forget(id), true],
            ]) {
                const action = new Gio.SimpleAction({name, enabled});
                action.connect('activate', () => later(run));
                actions.add_action(action);
            }
            row.insert_action_group('row', actions);
            const menu = new Gio.Menu();
            menu.append('Move up', 'row.move-up');
            menu.append('Move down', 'row.move-down');
            menu.append('Forget', 'row.forget');
            row.add_suffix(new Gtk.MenuButton({
                icon_name: 'view-more-symbolic', menu_model: menu, valign: Gtk.Align.CENTER,
                css_classes: ['flat'], tooltip_text: 'Move or forget',
            }));

            const source = new Gtk.DragSource({actions: Gdk.DragAction.MOVE});
            let hotspot = [0, 0];
            source.connect('prepare', (_source, x, y) => {
                hotspot = [x, y];
                return Gdk.ContentProvider.new_for_value(id);
            });
            source.connect('drag-begin', (_source, drag) => {
                const icon = new Gtk.ListBox({css_classes: ['boxed-list']});
                icon.set_size_request(row.get_width(), row.get_height());
                icon.append(new Adw.ActionRow({title: row.title, subtitle: row.subtitle}));
                Gtk.DragIcon.get_for_drag(drag).set_child(icon);
                drag.set_hotspot(...hotspot.map(Math.round));
            });
            row.add_controller(source);

            // Dropped on a row: before it, or after it in the row's lower half.
            const target = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE);
            target.connect('drop', (_target, dropped, _x, y) => {
                if (dropped === id)
                    return false;
                const at = index + (y > row.get_height() / 2 ? 1 : 0);
                later(() => move(dropped, box, at));
                return true;
            });
            row.add_controller(target);
            return row;
        };

        const rebuild = () => {
            const current = read();
            for (const box of BOXES) {
                listBoxes[box].remove_all();
                current[box].forEach((id, i) => listBoxes[box].append(makeRow(id, box, i, current[box].length)));
            }
        };
        // The lists follow changes from the bar (dragging there) while this is open.
        let rebuildId = 0;
        const queueRebuild = () => {
            if (rebuildId)
                return;
            rebuildId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                rebuildId = 0;
                rebuild();
                return GLib.SOURCE_REMOVE;
            });
        };
        const ids = ['left-items', 'center-items', 'right-items', 'hidden-items', 'shown-items']
            .map(key => settings.connect(`changed::${key}`, queueRebuild));
        window.connect('close-request', () => {
            ids.forEach(id => settings.disconnect(id));
            if (rebuildId)
                GLib.source_remove(rebuildId);
            return false;
        });
        rebuild();

        // Tray icons: their look, and icons of the theme instead of an app's own.
        const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        if (!iconTheme.get_search_path().includes(`${this.path}/tray/icons`))
            iconTheme.add_search_path(`${this.path}/tray/icons`);
        const trayPage = new GeneralPage(settings, TRAY_KEYS);
        trayPage.title = 'Tray Icons';
        window.add(trayPage);
        window.add(new CustomIconPage(settings, TRAY_KEYS));
        window.add(this._aboutPage());
    }

    // How to use the extension, and where its features and code come from.
    _aboutPage() {
        const page = new Adw.PreferencesPage({title: 'About', icon_name: 'help-about-symbolic'});

        page.add(new Adw.PreferencesGroup({
            title: `${this.metadata.name} ${this.metadata['version-name'] ?? ''}`.trim(),
            description: 'Arrange GNOME\'s top bar the direct way: move, hide and show its items, ' +
                'a transparent background, and apps\' tray icons with their menus.',
        }));

        const howTo = new Adw.PreferencesGroup({title: 'How to use it'});
        for (const [title, text] of [
            ['Move an item',
                'Hold the left mouse button on an item in the bar (clock, system menu, Activities, tray or ' +
                    'extension icons) and drag it: drop it on the left, in the centre or on the right. A plain ' +
                    'click still opens its menu.'],
            ['Transparent bar',
                'Double-click the empty part of the bar to make its background transparent; double-click again ' +
                    'for the normal bar.'],
            ['Order and sides in Settings',
                'On the Top Bar page the items are three lists, left, centre and right. Drag rows within a list ' +
                    'or between lists, or use each row\'s menu.'],
            ['Hide or always show',
                'Set an item to Default, Hidden or Always shown in its row. Forget removes an item that is gone for good.'],
            ['Tray icons',
                'Apps\' tray icons (AppIndicator, KStatusNotifierItem and legacy tray icons) appear in the bar with ' +
                    'their menus. New ones start on the right; drag them anywhere. The Tray Icons page sets their ' +
                    'look and size; Custom Icons replaces an app\'s icon with one from your icon theme.'],
            ['Remembered',
                'The order survives logins and the screen lock. Items that are away for now, such as an app\'s ' +
                    'tray icon while the app is closed, keep their place for when they come back.'],
        ]) {
            const row = new Adw.ActionRow({title, subtitle: text, subtitle_lines: 0});
            row.add_css_class('property');
            howTo.add(row);
        }
        page.add(howTo);

        const credits = new Adw.PreferencesGroup({
            title: 'Credits',
            description: 'Magic Top Bar replaces these two extensions; switch them off when you use it.',
        });
        const link = (title, subtitle, uri) => {
            const row = new Adw.ActionRow({title, subtitle, subtitle_lines: 0});
            row.add_suffix(new Gtk.LinkButton({label: 'Open', uri, valign: Gtk.Align.CENTER}));
            credits.add(row);
        };
        link('Adapted from Top Bar Organizer',
            'Arranging the top bar follows the Top Bar Organizer extension, adapted with its own code so it ' +
                'works with GNOME Shell 51, which Top Bar Organizer does not support.',
            'https://extensions.gnome.org/extension/4356/top-bar-organizer/');
        link('Tray icons from AppIndicator and KStatusNotifierItem Support',
            'The tray icon code comes from that extension by its authors, under the GPL 2.0 or later, which is ' +
                'why Magic Top Bar uses the same license.',
            'https://github.com/ubuntu/gnome-shell-extension-appindicator');
        if (this.metadata.url)
            link('Source code and issues', this.metadata.url, this.metadata.url);
        page.add(credits);
        return page;
    }
}
