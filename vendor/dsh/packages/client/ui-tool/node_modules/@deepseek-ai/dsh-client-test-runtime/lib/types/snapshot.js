/**
 * DOM snapshot hygiene: a vitest snapshot serializer that keeps `.snap`
 * files structural. Two normalizations, both on a clone (the live DOM is
 * untouched, so class/tag queries keep working):
 *
 * - CSS-module scoped class names (`_frame_334d2d`, this repo's
 *   `_[local]_[hash]` shape) fold back to their semantic local (`frame`), so
 *   CSS edits do not churn snapshots.
 * - `<svg>` internals collapse to a `data-content` fingerprint on the svg
 *   element: path geometry is print noise, but the fingerprint still flips
 *   when an icon's artwork actually changes.
 */
import { expect } from 'vitest';
/** One scoped class token: `_<local>_<hash>` (local may itself contain underscores). */
const SCOPED_CLASS = /^_(.+)_[a-z0-9]+$/;
/** Fold scoped tokens in one class attribute value; foreign tokens pass through. */
function normalizeClassValue(value) {
    return value
        .split(/\s+/)
        .filter(token => token !== '')
        .map(token => token.replace(SCOPED_CLASS, '$1'))
        .join(' ');
}
/** FNV-1a 32-bit over the svg markup: deterministic, dependency-free fingerprint. */
function fingerprint(markup) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < markup.length; i++) {
        hash ^= markup.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
/** svg elements of a subtree, the root included when it is one. */
function svgsOf(root) {
    const svgs = [...root.querySelectorAll('svg')];
    if (root.tagName.toLowerCase() === 'svg')
        svgs.unshift(root);
    return svgs;
}
/** Whether serializing this subtree needs a normalized clone. */
function needsNormalization(root) {
    const scoped = [root, ...root.querySelectorAll('[class]')].some((el) => {
        const value = el.getAttribute('class');
        return value !== null && value.split(/\s+/).some(token => SCOPED_CLASS.test(token));
    });
    return scoped || svgsOf(root).some(svg => svg.childNodes.length > 0);
}
/**
 * The serializer plugin. Matches DOM elements whose subtree carries a scoped
 * class or svg internals; serializes a normalized clone, which no longer
 * matches, so printing falls through to the built-in DOM element serializer.
 */
export const domSnapshotSerializer = {
    test(value) {
        return typeof Element !== 'undefined' && value instanceof Element && needsNormalization(value);
    },
    serialize(value, config, indentation, depth, refs, printer) {
        const clone = value.cloneNode(true);
        for (const el of [clone, ...clone.querySelectorAll('[class]')]) {
            const raw = el.getAttribute('class');
            if (raw !== null)
                el.setAttribute('class', normalizeClassValue(raw));
        }
        for (const svg of svgsOf(clone)) {
            if (svg.childNodes.length === 0)
                continue;
            svg.setAttribute('data-content', fingerprint(svg.innerHTML));
            svg.replaceChildren();
        }
        return printer(clone, config, indentation, depth, refs);
    },
};
let registered = false;
/**
 * Register {@link domSnapshotSerializer} with vitest's expect (idempotent).
 * SlotTestRuntime.create() calls this; specs that snapshot DOM outside the
 * runtime import and call it themselves.
 */
export function registerDomSnapshotSerializer() {
    if (registered)
        return;
    registered = true;
    expect.addSnapshotSerializer(domSnapshotSerializer);
}
//# sourceMappingURL=snapshot.js.map