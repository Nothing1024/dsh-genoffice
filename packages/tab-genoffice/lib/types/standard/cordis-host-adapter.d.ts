/**
 * host facet 的 cordis 适配器：把 dsh 宿主的私有服务面映射成
 * 标准 activation 的三个面。本插件里 cordis（host 侧）的耦合止步于此。
 *
 * 与部署描述（standards/host-descriptor.json）的关系：contracts.has 对
 * SystemPrompt / SkillRegistry / WebServer 恒答「有」——profile go 的
 * descriptor 声明了这四条能力，而 dsh 服务可能晚于插件激活到位，句柄
 * 内部用 acquireFromCordis 做延迟绑定；服务永不出现时 mount 不跑，
 * 等价于声明过的降级路径（一致性讨论见 standards/contributions/）。
 */
import type { Context } from '@deepseek-ai/cordis';
import { type ActivationController } from './sdk.ts';
export declare function createHostActivation(ctx: Context): ActivationController;
//# sourceMappingURL=cordis-host-adapter.d.ts.map