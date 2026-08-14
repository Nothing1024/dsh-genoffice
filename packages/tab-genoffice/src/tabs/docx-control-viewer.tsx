/**
 * FileViewer adapter: FileViewerProps → ControlModeViewer. One component
 * covers every claimed extension; ext is derived from the path.
 */
import { createElement } from 'react'
import type { ReactNode } from 'react'
import type { FileViewerProps } from 'dsh-better-sidebar'
import { ControlModeViewer } from './control-mode.tsx'
import { UPSTREAM_VIEWER_ID } from './coexist.ts'
import { extOf } from './relay.ts'
import css from './genoffice.module.css'

export function DocxControlViewer(props: FileViewerProps): ReactNode {
  const ext = extOf(props.path)
  return (
    <ControlModeViewer
      path={props.path}
      title={props.title}
      ext={ext}
      renderBuiltin={() => {
        const upstreamId = UPSTREAM_VIEWER_ID[ext]
        const builtin = props.ctx.betterSidebar.getFileViewers().find((v) => v.id === upstreamId)
        if (builtin === undefined) {
          return createElement('div', { className: css.hint }, '内置预览不可用')
        }
        return createElement(builtin.component, props)
      }}
    />
  )
}
