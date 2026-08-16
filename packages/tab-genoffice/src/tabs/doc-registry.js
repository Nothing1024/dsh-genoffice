"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupActive = lookupActive;
exports.subscribeActive = subscribeActive;
exports.registerActive = registerActive;
exports.resetActiveDocs = resetActiveDocs;
var active = new Map();
var listeners = new Set();
function notify() {
    for (var _i = 0, listeners_1 = listeners; _i < listeners_1.length; _i++) {
        var listener = listeners_1[_i];
        listener();
    }
}
function lookupActive(docId) {
    return active.get(docId);
}
function subscribeActive(listener) {
    listeners.add(listener);
    return function () { listeners.delete(listener); };
}
/** Register occupancy. Returns an unregister function. */
function registerActive(docId, entry) {
    active.set(docId, entry);
    queueMicrotask(notify);
    return function () {
        if (active.get(docId) === entry) {
            active.delete(docId);
            notify();
        }
    };
}
/** Test seam: drop every entry. */
function resetActiveDocs() {
    active.clear();
    notify();
}
