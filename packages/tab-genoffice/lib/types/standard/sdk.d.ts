/**
 * Vendored SDK shim for the dsh-community-standard facet surface.
 *
 * Mirrors spec/facet-api.md（草案 v0，九处决策点 2026-08-20 定案）与
 * spec/facet-model.md §2.2–2.3（快照 2026-08-28，见 standards/README.md）。
 * 上游尚无官方 SDK 包（原则 ⑧：定稿前任何 .d.ts 都不是稳定契约），因此本包
 * 先以本文件实现已定案的签名，让 facet 主体今天就写在标准面上；官方 SDK
 * 发布后，本文件整体替换为一条 import，facet 主体不动。
 *
 * INV-004：本文件的形状镜像 spec/facet-api.md 快照——改签名先改
 * standards/README.md 的快照结论，再同步这里。
 */
/** 契约坐标：能力的唯一门牌号（apiVersion + kind，精确匹配、无模糊兼容）。 */
export interface ContractCoordinate {
    readonly apiVersion: string;
    readonly kind: string;
}
/** facet-api §3：publish 的返回值。 */
export interface Disposable {
    dispose(): void;
}
/** facet-api §7 的稳定错误码集合。宿主与 SDK 不得发明未登记错误码。 */
export type StandardErrorCode = 'E_CONTRACT_NOT_DECLARED' | 'E_CONTRACT_UNAVAILABLE' | 'E_CONTRIBUTION_NOT_DECLARED' | 'E_DUPLICATE_PUBLISH' | 'E_WRONG_STATE' | 'E_STORAGE_QUOTA' | 'E_TIMEOUT';
/** facet-api §7：所有标准 API 抛出的错误必须是 StandardError。 */
export declare class StandardError extends Error {
    readonly code: StandardErrorCode;
    readonly contract?: ContractCoordinate;
    constructor(code: StandardErrorCode, message: string, contract?: ContractCoordinate);
}
/** 坐标的规范化 key（与 standards/validate.mjs 的协商实现同构）。 */
export declare function coordKey(c: ContractCoordinate): string;
/** facet-api §2：setup 收到的 activation 上下文，只有三个面（facet-model §2.3）。 */
export interface FacetActivation {
    readonly extensions: {
        /** 按契约坐标向 Broker 发布一个实现。坐标必须已在 manifest requires 声明。 */
        publish(coordinate: ContractCoordinate, id: string, implementation: unknown): Disposable;
    };
    readonly scope: {
        /** 注册清理函数（LIFO，deactivate 时由宿主调用；必须可重复执行）。 */
        add(dispose: () => void | Promise<void>): void;
    };
    readonly contracts: {
        /**
         * 领取协商通过的契约句柄。required 保证存在；optional 缺失抛
         * E_CONTRACT_UNAVAILABLE；未声明的坐标抛 E_CONTRACT_NOT_DECLARED。
         */
        get<T>(coordinate: ContractCoordinate): T;
        /** optional 降级路径的判定入口。 */
        has(coordinate: ContractCoordinate): boolean;
    };
}
/** facet-api §2：setup 可同步或异步；FacetHandle 在 v0.15 是保留位（空）。 */
export type FacetSetup = (activation: FacetActivation) => void | Promise<void>;
/**
 * facet 定义的品牌符号。用 Symbol.for 注册到全局符号表：装载检查器
 * （standards/validate.mjs）和跨构建产物的消费方无需共享模块实例即可识别。
 */
export declare const FACET_DEFINITION_BRAND: unique symbol;
/** facet-model §2.2：entry 模块默认导出的不透明 facet 定义。 */
export interface FacetDefinition {
    readonly [FACET_DEFINITION_BRAND]: true;
    readonly setup: FacetSetup;
}
/** facet-api §2：`export default defineFacet(setup)` 的构造器。 */
export declare function defineFacet(setup: FacetSetup): FacetDefinition;
/** 装载检查：默认导出是否是（任一构建实例的）facet 定义。 */
export declare function isFacetDefinition(value: unknown): value is FacetDefinition;
/** publish 的落点：宿主/适配器把 (id, implementation) 接进真实注册面。 */
export type PublishTarget = (id: string, implementation: unknown) => (() => void) | void;
/** createActivation 的装配选项——适配器与测试共用同一套纪律实现。 */
export interface ActivationOptions {
    /** manifest requires 的镜像：声明过的坐标（含 optional）。 */
    declared: readonly ContractCoordinate[];
    /** 实际可用的契约句柄（按 coordKey）。声明过但缺席的 optional 走降级。 */
    contracts?: ReadonlyMap<string, unknown>;
    /** publish 的落点（按 coordKey）。缺席时该坐标视为不可发布。 */
    publishTargets?: ReadonlyMap<string, PublishTarget>;
    /** scope.add 的旁路（如 cordis ctx.effect）。清理仍归 dispose() 统一驱动。 */
    onScopeAdd?: (dispose: () => void | Promise<void>) => void;
}
/** 一次 activation 的控制器：喂给 runFacet，用后 dispose 统一回收。 */
export interface ActivationController {
    readonly activation: FacetActivation;
    /** LIFO 执行 scope 清理并释放未撤回的发布（facet-api §3/§4）。可重复调用。 */
    dispose(): Promise<void>;
}
/**
 * 构造一个执行 facet-api 纪律的 activation：
 * 未声明即用 → E_CONTRACT_NOT_DECLARED；optional 缺席 get → E_CONTRACT_UNAVAILABLE；
 * 重复发布 → E_DUPLICATE_PUBLISH；dispose 后再用 → E_WRONG_STATE。
 */
export declare function createActivation(options: ActivationOptions): ActivationController;
/**
 * 驱动一个 facet 定义。setup 同步完成时本函数同步返回（宿主对同步插件
 * 不引入额外微任务——capability.spec 依赖注册在 apply 返回前完成）。
 */
export declare function runFacet(definition: FacetDefinition, activation: FacetActivation): void | Promise<void>;
//# sourceMappingURL=sdk.d.ts.map