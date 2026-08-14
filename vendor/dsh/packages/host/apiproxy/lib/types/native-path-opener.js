/** Cross-platform native path and text-document openers used by the local GUI carrier. */
import { runNativeCommand } from '@deepseek-ai/dsh-native-command';
/** PowerShell single-quoted literal (doubles embedded quotes). */
function powershellLiteral(path) {
    return `'${path.replace(/'/g, "''")}'`;
}
/** Dispatch one shell-free platform command for the requested open intent. */
async function openNativePathWithIntent(path, signal, intent, internals = {}) {
    const platform = internals.platform ?? process.platform;
    const run = internals.run ?? runNativeCommand;
    if (platform === 'darwin') {
        await run('open', intent === 'text-editor' ? ['-t', path] : [path], signal);
        return;
    }
    if (platform === 'win32') {
        await run('powershell.exe', [
            '-NoProfile',
            '-Command',
            `Invoke-Item -LiteralPath ${powershellLiteral(path)}`,
        ], signal);
        return;
    }
    if (platform === 'linux') {
        await run('xdg-open', [path], signal);
        return;
    }
    throw new Error(`native path opener is unsupported on ${platform}`);
}
/**
 * Open a filesystem path with the operating system's default application.
 * @param path - absolute or host-resolvable path (caller owns resolution).
 * @param signal - caller/connection lifetime; abort terminates the native command.
 * @param internals - platform and runner seam for deterministic tests.
 */
export function openNativePath(path, signal, internals = {}) {
    return openNativePathWithIntent(path, signal, 'default', internals);
}
/**
 * Open a text document for editing; macOS bypasses the file-type association
 * so a YAML association with a browser cannot consume the gesture.
 * @param path - absolute or host-resolvable text-document path.
 * @param signal - caller/connection lifetime; abort terminates the native command.
 * @param internals - platform and runner seam for deterministic tests.
 */
export function openNativeTextFile(path, signal, internals = {}) {
    return openNativePathWithIntent(path, signal, 'text-editor', internals);
}
//# sourceMappingURL=native-path-opener.js.map