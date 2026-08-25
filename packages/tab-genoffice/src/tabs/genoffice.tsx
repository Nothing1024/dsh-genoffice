/**
 * GenOffice tab panel: relay-backed file browser.
 *
 * Opening a previewable file calls `openTab` for a per-path document tab
 * instead of replacing this list. Initial list uses session cwd
 * (empty string = missing → homedir fallback). Path bar is a breadcrumb
 * with type-to-jump (BR-008 / BR-009).
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { TabComponentProps } from 'dsh-better-sidebar'
import { TAB_ICON_PROPS } from './icon.tsx'
import { PREVIEWABLE, RELAY_BASE, getRelayOk, launchRelay, noteRelayOk, probeRelay, probeRelayLaunch, subscribeRelay } from './relay.ts'
import { fileTabSeed } from './file-tab.ts'
import css from './genoffice.module.css'

interface DirEntry {
  name: string
  dir: boolean
  hidden: boolean
  symlink: boolean
  size: number | null
  mtimeMs: number | null
  ext?: string
}

interface DirResponse {
  ok: boolean
  path?: string
  parent?: string
  entries?: DirEntry[]
  error?: string
}

function joinPath(a: string, b: string): string {
  return a.endsWith('/') ? a + b : a + '/' + b
}

const ROW_ICON_PROPS = { ...TAB_ICON_PROPS, width: 14, height: 14 }

function FolderIcon(): ReactNode {
  return (
    <svg {...ROW_ICON_PROPS}>
      <path d="M2 4.5h4l1.5 2H14v6.5H2z" />
    </svg>
  )
}

function LinkIcon(): ReactNode {
  return (
    <svg {...ROW_ICON_PROPS}>
      <path d="M6.5 5.5 10 2a2.4 2.4 0 0 1 3.4 3.4L9.9 9a2.4 2.4 0 0 1-3.4 0" />
      <path d="M9.5 10.5 6 14a2.4 2.4 0 0 1-3.4-3.4l3.5-3.5a2.4 2.4 0 0 1 3.4 0" />
    </svg>
  )
}

function FileIcon(): ReactNode {
  return (
    <svg {...ROW_ICON_PROPS}>
      <path d="M4 2h5l3 3v9H4z" />
      <path d="M9 2v3h3M6.5 8.5h3M6.5 11h3" />
    </svg>
  )
}

function sessionCwd(cwd: string | undefined): string | undefined {
  if (cwd === undefined || cwd === '') return undefined
  return cwd
}

interface Crumb {
  label: string
  path: string
}

function crumbsOf(abs: string): Crumb[] {
  if (!abs.startsWith('/')) return []
  const parts = abs.split('/').filter(Boolean)
  const out: Crumb[] = [{ label: '/', path: '/' }]
  let acc = ''
  for (const part of parts) {
    acc += `/${part}`
    out.push({ label: part, path: acc })
  }
  return out
}

function PathBar(props: {
  path: string
  onJump: (abs: string) => void
  onInvalid: (msg: string) => void
}): ReactNode {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.path)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(props.path)
  }, [props.path, editing])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  const submit = (): void => {
    const raw = draft.trim()
    if (!raw.startsWith('/')) {
      props.onInvalid('请输入绝对路径（以 / 开头）')
      return
    }
    props.onJump(raw)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className={css.pathBar}>
        <input
          ref={inputRef}
          className={css.pathInput}
          value={draft}
          aria-label="跳转到路径"
          onChange={(e) => { setDraft(e.target.value) }}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => { setEditing(false) }}
        />
      </div>
    )
  }

  const all = crumbsOf(props.path)
  const collapsed = !expanded && all.length > 5
  const first = all[0]
  const shown: Crumb[] = collapsed && first !== undefined
    ? [first, { label: '…', path: '' }, ...all.slice(-3)]
    : all

  return (
    <div
      className={css.pathBar}
      title={props.path}
      aria-label="当前路径"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setDraft(props.path)
          setEditing(true)
        }
      }}
    >
      {shown.map((c, i) => (
        <button
          key={`${c.path}:${i}`}
          type="button"
          className={css.crumb}
          title={c.path || '展开完整路径'}
          onClick={() => {
            if (c.label === '…') {
              setExpanded(true)
              return
            }
            props.onJump(c.path)
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

export function GenOfficePanel(props: TabComponentProps): ReactNode {
  const cwd = sessionCwd(props.scope.cwd)
  const [path, setPath] = useState<string>('')
  const [parent, setParent] = useState<string | undefined>(undefined)
  const [entries, setEntries] = useState<DirEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathError, setPathError] = useState<string | null>(null)
  const [fellHome, setFellHome] = useState(false)
  const [relayOk, setRelayOk] = useState<boolean | null>(() => getRelayOk())
  const [launchConfigured, setLaunchConfigured] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const loadSeq = useRef(0)

  const loadList = async (nextPath?: string, asHome = false): Promise<void> => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError(null)
    setPathError(null)
    try {
      const resp = await fetch(`${RELAY_BASE}/api/dir?path=${encodeURIComponent(nextPath ?? '')}`)
      const data = (await resp.json()) as DirResponse
      if (seq !== loadSeq.current) return
      if (!data.ok) {
        setPathError(data.error ?? '路径不可读')
        noteRelayOk(false)
      } else {
        setPath(data.path ?? '')
        setParent(data.parent)
        setEntries((data.entries ?? []).filter((e) => !e.hidden))
        setFellHome(asHome || nextPath === undefined || nextPath === '')
        noteRelayOk(true)
      }
    } catch {
      if (seq !== loadSeq.current) return
      setError('relay 不可用')
      noteRelayOk(false)
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }

  const prevRelay = useRef<boolean | null>(getRelayOk())
  useEffect(() => {
    return subscribeRelay(() => {
      const ok = getRelayOk()
      const was = prevRelay.current
      prevRelay.current = ok
      setRelayOk(ok)
      if (was === false && ok === true) {
        void loadList(path || cwd, cwd === undefined && (path === '' || path === undefined))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, cwd])

  useEffect(() => {
    void probeRelayLaunch().then(setLaunchConfigured)
  }, [])

  const startRelay = async (): Promise<void> => {
    if (launching) return
    setLaunching(true)
    setLaunchError(null)
    const result = await launchRelay()
    setLaunching(false)
    if (result.ok) void probeRelay(true)
    else setLaunchError(result.error ?? 'timeout')
  }

  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    void loadList(cwd, cwd === undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [])

  const pickFile = (entry: DirEntry): void => {
    if (entry.dir || entry.symlink) {
      void loadList(joinPath(path, entry.name), false)
      return
    }
    const ext = entry.ext ?? ''
    if (PREVIEWABLE[ext] === undefined) return
    const abs = joinPath(path, entry.name)
    props.ctx.betterSidebar.openTab(fileTabSeed(abs), props.scope)
  }

  return (
    <div className={css.panel}>
      <div className={css.toolbar}>
        <button
          type="button"
          className={css.btn}
          title="回到主目录"
          onClick={() => { void loadList(undefined, true) }}
        >
          <svg {...ROW_ICON_PROPS}><path d="M2.5 7.5 8 2.5l5.5 5M4 6.5V14h8V6.5" /></svg>
          主目录
        </button>
        <button
          type="button"
          className={css.btn}
          disabled={cwd === undefined}
          title={cwd === undefined ? '当前会话没有项目目录' : '回到会话项目根'}
          onClick={() => { if (cwd !== undefined) void loadList(cwd, false) }}
        >
          项目根
        </button>
        <button
          type="button"
          className={css.btn}
          disabled={parent === undefined}
          title="上级目录"
          onClick={() => { if (parent !== undefined) void loadList(parent, false) }}
        >
          <svg {...ROW_ICON_PROPS}><path d="M8 13V3M4.5 6.5 8 3l3.5 3.5" /></svg>
          上级
        </button>
        <button
          type="button"
          className={css.btn}
          title="重新加载当前目录"
          onClick={() => { void loadList(path, fellHome) }}
        >
          <svg {...ROW_ICON_PROPS}><path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.9M13.5 2.5V5H11" /></svg>
          刷新
        </button>
        <PathBar
          path={path}
          onJump={(abs) => { void loadList(abs, false) }}
          onInvalid={(msg) => { setPathError(msg) }}
        />
        {fellHome && <span className={css.homeNote}>已回落到主目录</span>}
      </div>
      {relayOk === false && (
        <div className={css.hint} role="status">
          GenOffice relay 不可用 — 在仓库执行 `node web/server.mjs` 后点重新检查。
          <button type="button" className={css.btn} onClick={() => { void probeRelay(true) }}>重新检查</button>
          {launchConfigured && (
            <>
              <button
                type="button"
                className={css.btn}
                disabled={launching}
                onClick={() => { void startRelay() }}
              >
                {launching ? '启动中…' : '启动 relay'}
              </button>
              {launchError !== null && (
                <span>启动失败：{launchError} — 手动执行 `node scripts/dev.mjs start-relay`</span>
              )}
            </>
          )}
        </div>
      )}
      {loading && <div className={css.hint}>加载中…</div>}
      {!loading && pathError !== null && (
        <div className={css.hint}>{pathError}</div>
      )}
      {!loading && error !== null && (
        <div className={css.hint}>
          {error}
          <button type="button" className={css.btn} onClick={() => { void loadList(path || cwd, fellHome) }}>重试</button>
        </div>
      )}
      {!loading && error === null && entries !== null && entries.length === 0 && pathError === null && (
        <div className={css.hint}>空目录</div>
      )}
      {!loading && error === null && entries !== null && (
        <div className={css.list}>
          {entries.map((entry) => {
            const previewable = !entry.dir && !entry.symlink && PREVIEWABLE[entry.ext ?? ''] !== undefined
            const clickable = entry.dir || entry.symlink || previewable
            return (
              <div
                key={entry.name}
                className={`${css.row} ${clickable ? css.rowClickable : css.rowDisabled}`}
                title={entry.dir ? '进入目录' : entry.symlink ? '符号链接（可能指向目录）' : previewable ? '点击预览' : '网页版不可预览'}
                onClick={() => { pickFile(entry) }}
              >
                <span className={css.rowIcon}>
                  {entry.dir ? <FolderIcon /> : entry.symlink ? <LinkIcon /> : <FileIcon />}
                </span>
                <span className={css.rowName}>{entry.name}</span>
                {!entry.dir && !previewable && !entry.symlink && <span className={css.rowTag}>网页版不可预览</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
