/**
 * 本插件声明的私有契约坐标（x- 命名空间）与各坐标的句柄接口。
 *
 * 单一事实源纪律（INV-004）：
 * - 机器可读条目（sensitivity / lifecycleScope 等）在 standards/registry/*.json；
 * - manifest 的 requires.contracts 必须与本文件的 REQUIRED/OPTIONAL 声明一致
 *   （tests/standard-facet.spec.ts 有镜像断言）；
 * - 句柄形状是「SDK 面」：刻意小于宿主实现面（对齐上游 RFC 0006 的设计原则），
 *   cordis 侧的映射只存在于 src/standard/cordis-*.ts 适配器。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ContractCoordinate } from './sdk.ts';
/** LLM 工具注册（required）。经 extensions.publish(坐标, 工具名, 定义) 发布。 */
export declare const TOOL_REGISTRY: ContractCoordinate;
/** 系统提示词分段注入（optional；上游对应物是 RFC 0006 的 PromptSections）。 */
export declare const SYSTEM_PROMPT: ContractCoordinate;
/** 运行时 skill 目录注册（optional）。 */
export declare const SKILL_REGISTRY: ContractCoordinate;
/** 宿主 HTTP 路由（optional；上游对应物是 RFC 0006 的 WebRoutes）。 */
export declare const WEB_SERVER: ContractCoordinate;
/** 客户端词典/翻译（client 半身 required）。 */
export declare const LOCALE: ContractCoordinate;
/** better-sidebar 页签与 FileViewer 槽位（client 半身 optional peer）。 */
export declare const SIDEBAR_TAB: ContractCoordinate;
/** host facet 的 requires 镜像（required 在前）。 */
export declare const HOST_REQUIRED: readonly ContractCoordinate[];
export declare const HOST_OPTIONAL: readonly ContractCoordinate[];
/** client facet 的声明镜像（RFC 0002 定案后进 manifest）。 */
export declare const CLIENT_REQUIRED: readonly ContractCoordinate[];
export declare const CLIENT_OPTIONAL: readonly ContractCoordinate[];
/** manifest permissions 的敏感 scope（契约坐标之外的环境能力，见 registry/permissions.md）。 */
export declare const PERMISSION_LOOPBACK_FETCH = "x-nothing1024.net.loopback-fetch";
export declare const PERMISSION_PROCESS_SPAWN = "x-nothing1024.process.spawn";
/**
 * 延迟到位的宿主服务的统一领取原语：mount 在服务可用时被调用零或一次
 * （零次 = 部署缺席，即声明过的降级路径），返回的卸载函数与 acquire 的
 * 返回值都能撤销挂载。这是对 DSH「服务可能晚于插件激活到位」现实的
 * 诚实建模——协商是静态的，绑定是延迟的。
 */
export type ServiceAcquire<S> = (mount: (service: S) => () => void) => () => void;
/** WebServer 契约的服务面（镜像自宿主 webServer 的最小使用面）。 */
export interface WebServerLike {
    readonly host: string;
    readonly port: number;
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void;
    }): () => void;
}
/** WebServer 句柄：路由与静态绑定信息都要等服务到位，因此只有 acquire。 */
export interface WebServerHandle {
    acquire: ServiceAcquire<WebServerLike>;
}
/** SystemPrompt 句柄：注入一个命名提示词段，返回卸载函数。 */
export interface SystemPromptHandle {
    section(spec: {
        name: string;
        order: number;
        text: string;
    }): () => void;
}
/** SkillRegistry 句柄：注册一条运行时 skill，返回卸载函数。 */
export interface SkillRegistryHandle {
    register(skill: {
        name: string;
        description: string;
        content: string;
        source: string;
    }): () => void;
}
/** Locale 句柄（client）：命名空间词典注册 + 绑定翻译函数。 */
export interface LocaleHandle {
    bind(ns: string): (key: string, params?: Record<string, string>) => string;
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void;
}
/**
 * SidebarTab 句柄（client）：better-sidebar 是 optional peer 且可能晚到，
 * 与 WebServer 同为 acquire 形态。服务面类型由消费方（client facet）以
 * `dsh-better-sidebar` 的类型参数化，本文件不引 UI 依赖。
 */
export interface SidebarAcquireHandle<S> {
    acquire: ServiceAcquire<S>;
}
//# sourceMappingURL=coordinates.d.ts.map