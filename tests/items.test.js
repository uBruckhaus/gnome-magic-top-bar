// Run: gjs -m tests/items.test.js
import System from 'system';
import {itemName, mergeOrder, moveItem} from '../magic-top-bar@ubruckhaus.github.io/items.js';

let failures = 0;
function check(name, actual, expected) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures++;
        print(`FAIL ${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
}

const lists = {left: ['activities', 'a'], center: ['dateMenu'], right: ['b', 'quickSettings']};
check('move within a list, forward', moveItem(lists, 'activities', 'left', 2).left, ['a', 'activities']);
check('move within a list, back', moveItem(lists, 'quickSettings', 'right', 0).right, ['quickSettings', 'b']);
const across = moveItem(lists, 'b', 'center', 0);
check('move across: taken out', across.right, ['quickSettings']);
check('move across: put in', across.center, ['b', 'dateMenu']);
check('move to the end', moveItem(lists, 'a', 'right', Infinity).right, ['b', 'quickSettings', 'a']);
check('source lists untouched', lists.left, ['activities', 'a']);

// Items not in the bar keep their place after the item they followed.
const inBar = id => ['x', 'y', 'z'].includes(id);
check('absent item stays after its neighbour', mergeOrder(['x', 'gone', 'y'], ['y', 'x'], inBar), ['y', 'x', 'gone']);
check('absent item at the start', mergeOrder(['gone', 'x'], ['x'], inBar), ['gone', 'x']);
check('item moved to another box is dropped here', mergeOrder(['x', 'y'], ['x'], inBar), ['x']);
check('new item joins', mergeOrder(['x'], ['x', 'z'], inBar), ['x', 'z']);

check('built-in name', itemName('dateMenu'), 'Clock and calendar');
check('tray name', itemName('appindicator:nextcloud'), 'Tray icon: nextcloud');
check('extension name', itemName('foo@bar', new Map([['foo@bar', 'Foo']])), 'Foo');

print(failures ? `${failures} failures` : 'all item tests passed');
System.exit(failures ? 1 : 0);
