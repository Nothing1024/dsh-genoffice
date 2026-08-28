/**
 * cordis 侧的 ServiceAcquire 实现：把「lookup 已到位的服务，否则嵌套
 * inject 等它到位」这一在 prompt/skill/sync/relay-launch/assets 里手抄了
 * 五份的模式收敛成一个原语。标准层（facet 主体）只见 ServiceAcquire，
 * cordis 耦合止步于此文件与两个 adapter。
 */
import type { ServiceAcquire } from './coordinates.ts'

/** 适配器需要的最小 cordis 面（真实 Context 与测试板凳都满足）。 */
export interface CordisLike {
  effect(callback: () => void | (() => void), label?: string): void
  inject(deps: string[], callback: (ctx: unknown) => void): void
}

/**
 * 构造一个 ServiceAcquire：
 * - 服务已到位（lookup 命中）→ 立即经 ctx.effect 挂载（disposer 归 fiber）；
 * - 未到位 → ctx.inject 等服务出现，出现后在子 ctx 的 effect 里挂载；
 * - 部署里永远不出现 → mount 一次都不跑（声明过的降级路径）。
 * acquire 返回的取消函数可提前卸载；与 fiber 卸载互为幂等。
 */
export function acquireFromCordis<S>(
  ctx: CordisLike,
  lookup: () => S | undefined,
  serviceName: string,
  label = `dsh-tab-genoffice: acquire ${serviceName}`,
): ServiceAcquire<S> {
  return (mount) => {
    let cancelled = false
    let unmount: (() => void) | undefined

    const runMount = (service: S): (() => void) => {
      if (cancelled) return () => {}
      const off = mount(service)
      unmount = () => {
        unmount = undefined
        off()
      }
      return () => {
        unmount?.()
      }
    }

    const existing = lookup()
    if (existing !== undefined) {
      ctx.effect(() => runMount(existing), label)
    } else {
      ctx.inject([serviceName], (child) => {
        const service = (child as Record<string, unknown>)[serviceName] as S
        const effect = (child as Partial<CordisLike>).effect
        if (typeof effect === 'function') {
          effect.call(child, () => runMount(service), label)
        } else {
          runMount(service)
        }
      })
    }

    return () => {
      cancelled = true
      unmount?.()
    }
  }
}
