/**
 * client facet 的 cordis 适配器：把 dsh client runtime 的 locale 服务与
 * better-sidebar（optional peer，可能晚到）映射成标准 activation。
 * client 侧的 cordis 耦合止步于此文件与 src/client/index.ts 两行胶水。
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ActivationController } from './sdk.ts';
export declare function createClientActivation(ctx: ClientContext): ActivationController;
//# sourceMappingURL=cordis-client-adapter.d.ts.map