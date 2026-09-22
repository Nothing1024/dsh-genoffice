/**
 * client facet 的 cordis 适配器：locale + 官方右侧 Sidebar
 * （`sidebarRight` / `sidebarRightTabs` / `slots`，optional，可能晚到）。
 * client 侧的 cordis 耦合止步于此文件与 src/client/index.ts。
 *
 * Do not read `ctx.sidebarRight` (etc.) on the parent fiber: Cordis 4
 * throws `cannot get property "…" without inject`. Peek through
 * `ctx.reflect.get(name, false)` or own properties on test benches.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type ActivationController } from './sdk.ts';
export declare function createClientActivation(ctx: ClientContext): ActivationController;
//# sourceMappingURL=cordis-client-adapter.d.ts.map