/**
 * Control-mode body for claimed Office files on the official right Sidebar.
 * Path comes from the tab's `dsh-resource://file/…` contentId.
 */
import { useCallback } from 'react'
import type { ReactNode } from 'react'
import type { SidebarPaneTabProps } from '../standard/sidebar.ts'
import { ControlModeViewer } from './control-mode.tsx'
import { resolveSessionFilePath } from './resolve-session-path.ts'
import { extOf } from './relay.ts'
import css from './genoffice.module.css'

export function renderDegradeFallback(): ReactNode {
  return (
    <div className={css.hint}>
      没有可用的后备预览。启动 GenOffice relay 后可恢复控制模式。
    </div>
  )
}

export function DocxControlViewer(props: {
  path: string
  title: string
  tabId?: string
  onBack?: () => void
}): ReactNode {
  return (
    <ControlModeViewer
      path={props.path}
      title={props.title}
      ext={extOf(props.path)}
      renderBuiltin={renderDegradeFallback}
      {...(props.tabId !== undefined ? { tabId: props.tabId } : {})}
      {...(props.onBack !== undefined ? { onBack: props.onBack } : {})}
    />
  )
}

/** Per-file sidebar tab: control-mode plus Back (closes the tab; UF-003). */
export function GenOfficeFileTab(props: SidebarPaneTabProps): ReactNode {
  const info = props.useTabInfo()
  const byId = props.useSessions?.((sessions) => sessions.byId)
  const resolved = resolveSessionFilePath(info.tab.contentId, {
    ...(byId !== undefined ? { byId } : {}),
    sessionsPending: props.useSessions !== undefined && byId === undefined,
  })
  const onBack = useCallback(() => {
    info.tab.actions.close()
  }, [info.tab.actions])
  if (resolved.status === 'waiting') {
    return (
      <div className={css.hint}>
        正在等待会话目录…
      </div>
    )
  }
  if (resolved.status === 'error') {
    return (
      <div className={css.panel}>
        <div className={css.hint} role="alert">
          {resolved.message}
        </div>
        <button className={css.btn} type="button" onClick={onBack}>返回</button>
      </div>
    )
  }
  return (
    <DocxControlViewer
      path={resolved.path}
      title={info.tab.title}
      tabId={info.tab.id}
      onBack={onBack}
    />
  )
}
