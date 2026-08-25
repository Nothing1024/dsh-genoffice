/**
 * FileViewer adapter: FileViewerProps → ControlModeViewer. One component
 * covers every claimed extension; ext is derived from the path.
 */
import { createElement } from 'react'
import type { ReactNode } from 'react'
import type { FileViewerProps, TabComponentProps } from 'dsh-better-sidebar'
import { ControlModeViewer } from './control-mode.tsx'
import { OWN_VIEWER_PREFIX, pickDegradeViewer } from './coexist.ts'
import { extOf } from './relay.ts'
import css from './genoffice.module.css'

/** Relay-down fallback: another enabled FileViewer, never this plugin's own. */
export function renderDegradeFallback(props: FileViewerProps): ReactNode {
  const sidebar = props.ctx.betterSidebar
  const builtin = pickDegradeViewer(
    sidebar.getFileViewers(),
    extOf(props.path),
    props.viewerId,
    (id) => sidebar.isViewerEnabled(id),
  )
  if (builtin === undefined) {
    return createElement('div', { className: css.hint }, '没有可用的后备预览')
  }
  return createElement(builtin.component, { ...props, viewerId: builtin.id })
}

export function DocxControlViewer(props: FileViewerProps): ReactNode {
  const ext = extOf(props.path)
  return (
    <ControlModeViewer
      path={props.path}
      title={props.title}
      ext={ext}
      renderBuiltin={() => renderDegradeFallback(props)}
    />
  )
}

/** Per-file sidebar tab: same control-mode surface as the FileViewer, no Back. */
export function GenOfficeFileTab(props: TabComponentProps): ReactNode {
  const path = props.tab.path ?? ''
  return (
    <DocxControlViewer
      ctx={props.ctx}
      store={props.store}
      scope={props.scope}
      path={path}
      title={props.tab.title}
      viewerId={`${OWN_VIEWER_PREFIX}${extOf(path)}`}
    />
  )
}
