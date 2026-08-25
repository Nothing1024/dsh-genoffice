/**
 * The single control-mode surface: health probe, iframe, toolbar (save /
 * reload-from-disk / browser-open / back), and relay-down degrade.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { TAB_ICON_PROPS } from './icon.tsx'
import { DEGRADE_MODE, type DegradeMode } from './coexist.ts'
import { lookupActive, registerActive, subscribeActive } from './doc-registry.ts'
import {
  PREVIEWABLE,
  RELAY_BASE,
  docIdFor,
  getRelayOk,
  launchRelay,
  notifyHostSync,
  previewUrlFor,
  probeRelay,
  probeRelayLaunch,
  subscribeRelay,
} from './relay.ts'
import css from './genoffice.module.css'

const ROW_ICON_PROPS = { ...TAB_ICON_PROPS, width: 14, height: 14 }

const BROWSER_OPEN_TITLE =
  '离开控制模式；网页版 AI 面板可直连第三方模型服务商，可能出网'

const RELAY_MANUAL = '`node scripts/dev.mjs start-relay`'

export interface ControlModeViewerProps {
  path: string
  title: string
  ext: string
  onBack?: () => void
  renderBuiltin?: () => ReactNode
  degradeMode?: DegradeMode
  tabId?: string
  updateTab?: (id: string, patch: { title?: string; path?: string; meta?: unknown }) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error'

function copyPathOf(abs: string, at = new Date(), withSeconds = false): string {
  const slash = Math.max(abs.lastIndexOf('/'), abs.lastIndexOf('\\'))
  const dir = slash < 0 ? '' : abs.slice(0, slash + 1)
  const base = slash < 0 ? abs : abs.slice(slash + 1)
  const dot = base.lastIndexOf('.')
  const stem = dot < 0 ? base : base.slice(0, dot)
  const ext = dot < 0 ? '' : base.slice(dot + 1)
  const y = String(at.getFullYear())
  const mo = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  const h = String(at.getHours()).padStart(2, '0')
  const mi = String(at.getMinutes()).padStart(2, '0')
  const stamp = withSeconds
    ? `${y}${mo}${d}-${h}${mi}${String(at.getSeconds()).padStart(2, '0')}`
    : `${y}${mo}${d}-${h}${mi}`
  return `${dir}${stem} (副本 ${stamp}).${ext}`
}

export function ControlModeViewer(props: ControlModeViewerProps): ReactNode {
  const { path, title, ext, onBack, renderBuiltin, tabId, updateTab } = props
  const degradeMode = props.degradeMode ?? DEGRADE_MODE
  const [relayOk, setRelayOk] = useState<boolean | null>(() => getRelayOk())
  const [yielded, setYielded] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [frameNonce, setFrameNonce] = useState(() => crypto.randomUUID())
  const [syncing, setSyncing] = useState(false)
  const [popupHint, setPopupHint] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [launchConfigured, setLaunchConfigured] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const probeSeq = useRef(0)

  const busy = saveState === 'saving' || syncing || launching

  const unloadPreview = (): void => {
    const prev = iframeRef.current
    if (prev !== null) prev.src = 'about:blank'
  }

  const remountControl = async (): Promise<void> => {
    setDirty(false)
    setSyncing(true)
    setPreviewLoaded(false)
    setPreviewError(false)
    await notifyHostSync(path)
    setFrameNonce(crypto.randomUUID())
  }

  const probe = (force = true): void => {
    const seq = ++probeSeq.current
    setRelayOk(null)
    setYielded(false)
    const ac = new AbortController()
    void probeRelay(force, ac.signal).then((ok) => {
      if (seq !== probeSeq.current) return
      setRelayOk(ok)
    })
  }

  useEffect(() => {
    return subscribeRelay(() => { setRelayOk(getRelayOk()) })
  }, [])

  useEffect(() => {
    void probeRelayLaunch().then(setLaunchConfigured)
  }, [])

  useEffect(() => {
    setDirty(false)
    probe(false)
    return () => {
      probeSeq.current += 1
      unloadPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount per path via key
  }, [path])

  useEffect(() => {
    let cancelled = false
    let unregister: (() => void) | undefined
    const tryClaim = (): void => {
      void docIdFor(path).then((id) => {
        if (cancelled) return
        if (unregister !== undefined) return
        if (lookupActive(id) !== undefined) {
          setBlocked(true)
          return
        }
        setBlocked(false)
        unregister = registerActive(id, { surface: onBack === undefined ? 'viewer' : 'tab' })
      })
    }
    tryClaim()
    const stop = subscribeActive(tryClaim)
    return () => {
      cancelled = true
      stop()
      unregister?.()
    }
  }, [path, onBack])

  useEffect(() => {
    if (saveState !== 'saved') return
    const timer = window.setTimeout(() => {
      setSaveState('idle')
      setSaveMessage(null)
    }, 4000)
    return () => { window.clearTimeout(timer) }
  }, [saveState])

  useEffect(() => {
    const onMsg = (event: MessageEvent): void => {
      void (async () => {
        const data = event.data as { type?: unknown; docId?: unknown; dirty?: unknown } | null
        if (event.origin !== RELAY_BASE) return
        if (data === null || typeof data !== 'object') return
        if (data.type !== 'genoffice:dirty') return
        if (typeof data.dirty !== 'boolean' || typeof data.docId !== 'string') return
        const id = await docIdFor(path)
        if (data.docId !== id) return
        setDirty(data.dirty)
      })()
    }
    window.addEventListener('message', onMsg)
    return () => { window.removeEventListener('message', onMsg) }
  }, [path])

  useEffect(() => {
    if (tabId === undefined || updateTab === undefined) return
    const base = title.replace(/^● /, '')
    const next = dirty ? `● ${base}` : base
    if (next === title) return
    updateTab(tabId, { title: next })
  }, [dirty, tabId, title, updateTab])

  const startRelay = async (): Promise<void> => {
    if (launching) return
    setLaunching(true)
    setLaunchError(null)
    const result = await launchRelay()
    setLaunching(false)
    if (result.ok) probe(true)
    else setLaunchError(result.error ?? 'timeout')
  }

  const launchControls = launchConfigured && (
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
        <span>启动失败：{launchError} — 手动执行 {RELAY_MANUAL}</span>
      )}
    </>
  )

  const saveToDisk = async (): Promise<void> => {
    if (busy) return
    const app = PREVIEWABLE[ext]
    if (app === undefined) return
    const docId = await docIdFor(path)
    setSaveState('saving')
    setSaveMessage(null)
    try {
      const resp = await fetch(`${RELAY_BASE}/api/control/${app}/${docId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      const data = (await resp.json()) as { ok?: boolean; error?: string; path?: string; mtimeMs?: unknown }
      if (data.ok) {
        setSaveState('saved')
        if (typeof data.mtimeMs === 'number') {
          setDirty(false)
          setSaveMessage(`已保存到 ${data.path ?? path}（编辑状态已保留）`)
        } else {
          setSaveMessage(`已保存到 ${data.path ?? path}`)
          await remountControl()
        }
      } else if (data.error === 'conflict') {
        setSaveState('conflict')
        setSaveMessage('文件已被外部修改，未覆盖 — 请点「从磁盘重载」后再保存')
      } else if (data.error === 'executor not registered') {
        setSaveState('error')
        setSaveMessage('文档未在控制模式打开（执行器未注册）— 请重新打开预览')
      } else {
        setSaveState('error')
        setSaveMessage(`写入失败：${data.error ?? '未知错误'}`)
      }
    } catch (e) {
      setSaveState('error')
      setSaveMessage(`写入失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const writeCopy = async (saveAs: string, retried = false): Promise<void> => {
    const app = PREVIEWABLE[ext]
    if (app === undefined) return
    const docId = await docIdFor(path)
    setSaveState('saving')
    setSaveMessage(null)
    try {
      const resp = await fetch(`${RELAY_BASE}/api/control/${app}/${docId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, saveAs }),
      })
      const data = (await resp.json()) as { ok?: boolean; error?: string; path?: string }
      if (data.ok) {
        setSaveState('saved')
        setSaveMessage(`已另存为 ${data.path ?? saveAs}`)
        return
      }
      if (data.error === 'exists') {
        setSaveState('conflict')
        setSaveMessage('副本已存在，未覆盖')
        if (!retried && window.confirm('副本已存在，换个名字再试？')) {
          await writeCopy(copyPathOf(path, new Date(), true), true)
        }
        return
      }
      setSaveState('error')
      setSaveMessage(`另存失败：${data.error ?? '未知错误'}`)
    } catch (e) {
      setSaveState('error')
      setSaveMessage(`另存失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const saveAsCopy = async (): Promise<void> => {
    if (busy) return
    await writeCopy(copyPathOf(path))
  }

  const reloadFromDisk = (): void => {
    if (busy) return
    if (dirty) {
      if (!window.confirm('有未保存的编辑，从磁盘重新加载会丢失。确定？')) return
    } else if (!window.confirm('从磁盘重新加载？未保存的编辑会丢失。')) {
      return
    }
    void remountControl()
  }

  const openInBrowser = (): void => {
    const win = window.open(previewUrlFor(path, ext, false), '_blank', 'noopener')
    if (win === null) setPopupHint(true)
  }

  const goBack = (): void => {
    if (dirty && !window.confirm('有未保存的编辑，确定离开？')) return
    unloadPreview()
    onBack?.()
  }

  const toolbar = (
    <div className={css.toolbar}>
      {onBack !== undefined && (
        <button type="button" className={css.btn} disabled={busy} onClick={goBack}>
          <svg {...ROW_ICON_PROPS}><path d="M10.5 3.5 6 8l4.5 4.5" /></svg>
          返回
        </button>
      )}
      <span className={css.fileName} title={path}>{title}</span>
      <button
        type="button"
        className={dirty ? `${css.btn} ${css.btnDirty}` : css.btn}
        disabled={busy}
        title="将当前编辑内容原子写回原文件"
        onClick={() => { void saveToDisk() }}
      >
        <svg {...ROW_ICON_PROPS}><path d="M11 2H4v12h12V5zM8 2v4h4V2M8 14V9h4v5" /></svg>
        {saveState === 'saving' ? '写入中…' : '写入磁盘'}
      </button>
      <button
        type="button"
        className={css.btn}
        disabled={busy}
        title="丢弃未保存编辑，从磁盘重新打开并重新武装控制模式"
        onClick={reloadFromDisk}
      >
        <svg {...ROW_ICON_PROPS}><path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.9M13.5 2.5V5H11" /></svg>
        从磁盘重载
      </button>
      <button
        type="button"
        className={css.btn}
        style={{ marginLeft: 'auto' }}
        disabled={busy}
        title={BROWSER_OPEN_TITLE}
        onClick={openInBrowser}
      >
        <svg {...ROW_ICON_PROPS}><path d="M6 3H3.5v9.5H13V10M9 3h4v4M13 3l-6 6" /></svg>
        在浏览器中打开
      </button>
    </div>
  )

  const relayStrip = relayOk === false && (
    <div className={css.hint} role="status">
      GenOffice relay 不可用 — 在仓库执行 `node web/server.mjs` 后点重新检查。
      <button type="button" className={css.btn} onClick={() => { probe(true) }}>重新检查</button>
      {launchControls}
    </div>
  )

  if (blocked) {
    return (
      <div className={css.panel}>
        {toolbar}
        {relayStrip}
        <div className={css.hint}>该文档已在另一处打开 — 请先关掉另一侧，避免两个执行器抢注册</div>
      </div>
    )
  }

  if (yielded && renderBuiltin !== undefined) {
    return (
      <div className={css.panel}>
        {toolbar}
        {relayStrip}
        {renderBuiltin()}
      </div>
    )
  }

  if (relayOk === null) {
    return (
      <div className={css.panel}>
        {toolbar}
        <div className={css.hint}>正在检查 GenOffice relay…</div>
      </div>
    )
  }

  if (!relayOk) {
    const recheck = (
      <button type="button" className={css.btn} onClick={() => { probe(true) }}>重新检查</button>
    )
    if (degradeMode === 'auto' && renderBuiltin !== undefined) {
      return (
        <div className={css.panel}>
          {toolbar}
          <div className={css.hint} role="status">
            GenOffice relay 不可用 — 已切换后备预览。在仓库执行 `node web/server.mjs` 后可恢复控制模式。
            {recheck}
            {launchControls}
          </div>
          {renderBuiltin()}
        </div>
      )
    }
    return (
      <div className={css.panel}>
        {toolbar}
        <div className={css.hint} role="status">
          GenOffice relay 不可用 — 控制模式需要 localhost:8787 上的中继。启动命令：`node web/server.mjs`
          {renderBuiltin !== undefined && degradeMode === 'manual' && (
            <button type="button" className={css.btn} onClick={() => { setYielded(true) }}>
              用后备预览打开
            </button>
          )}
          {recheck}
          {launchControls}
        </div>
      </div>
    )
  }

  const url = previewUrlFor(path, ext, true, frameNonce)
  return (
    <div className={css.panel}>
      {toolbar}
      {popupHint && <div className={css.hint}>弹窗被拦截 — 请允许弹窗后重试</div>}
      {syncing && <div className={css.hint} role="status">正在同步…</div>}
      {saveMessage !== null && saveState !== 'idle' && !syncing && (
        <div
          className={css.hint}
          style={{ color: saveState === 'saved' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)' }}
        >
          {saveState === 'saving' ? '写入中…' : saveMessage}
          {saveState === 'conflict' && (
            <button type="button" className={css.btn} disabled={busy} onClick={() => { void saveAsCopy() }}>
              另存为副本
            </button>
          )}
        </div>
      )}
      {previewError
        ? (
          <div className={css.hint}>
            预览加载失败
            <button
              type="button"
              className={css.btn}
              disabled={busy}
              onClick={() => { void remountControl() }}
            >重试</button>
          </div>
        )
        : (
          <iframe
            key={frameNonce}
            ref={iframeRef}
            src={url}
            className={css.iframe}
            title={title}
            sandbox="allow-scripts allow-same-origin allow-downloads"
            onLoad={() => {
              setPreviewLoaded(true)
              setSyncing(false)
            }}
          />
        )}
      {!previewLoaded && !previewError && <div className={css.hint}>{syncing ? '正在同步…' : '预览加载中…'}</div>}
      <PreviewTimeout
        loaded={previewLoaded}
        nonce={frameNonce}
        onTimeout={() => { setPreviewError(true); setSyncing(false) }}
      />
    </div>
  )
}

/** pdf/sheets first paint can exceed 10s (pdf.js worker + Univer). Host
 *  *_open polls registration for 20s — a shorter iframe timeout unmounts
 *  the executor first (UF-004). Re-arm on each remount nonce. */
function PreviewTimeout({ loaded, nonce, onTimeout }: { loaded: boolean; nonce: string; onTimeout: () => void }): ReactNode {
  useEffect(() => {
    if (loaded) return
    const timer = window.setTimeout(onTimeout, 30_000)
    return () => { window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount via nonce; onTimeout is stable enough
  }, [loaded, nonce])
  return null
}
