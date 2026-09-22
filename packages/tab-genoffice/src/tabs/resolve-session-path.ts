/**
 * Restore a Sidebar file address to a disk path using the *address*
 * session's cwd. Never uses the currently active session to steal
 * another session's relative path (BR-001).
 */
import { isAbsoluteWorkspacePath, parseFileAddress } from './file-address.ts'

export type SessionCwdMap = Record<string, { cwd?: string } | undefined>

export type ResolveSessionPathResult =
  | { status: 'ready'; path: string }
  | { status: 'waiting'; reason: 'sessions-pending' }
  | { status: 'error'; error: 'malformed-address' | 'unknown-session' | 'missing-cwd'; message: string }

function joinCwd(cwd: string, relative: string): string {
  const root = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  const rest = relative.replace(/\\/g, '/').replace(/^(?:\.\/)+/, '').replace(/^\/+/, '')
  if (rest === '') return root
  if (root === '') return rest
  return `${root}/${rest}`
}

export function resolveSessionFilePath(
  address: string,
  options: {
    byId?: SessionCwdMap
    sessionsPending?: boolean
  } = {},
): ResolveSessionPathResult {
  const parsed = parseFileAddress(address)
  if (parsed === undefined) {
    return {
      status: 'error',
      error: 'malformed-address',
      message: '无法解析文件地址，已阻止打开（未请求 relay）',
    }
  }
  if (parsed.scope === 'absolute' || isAbsoluteWorkspacePath(parsed.path)) {
    return { status: 'ready', path: parsed.path }
  }
  if (options.sessionsPending || options.byId === undefined) {
    return { status: 'waiting', reason: 'sessions-pending' }
  }
  const session = options.byId[parsed.sessionId]
  if (session === undefined) {
    return {
      status: 'error',
      error: 'unknown-session',
      message: `地址属于会话 ${parsed.sessionId}，当前会话列表中没有该会话`,
    }
  }
  const cwd = session.cwd
  if (cwd === undefined || cwd === '') {
    return {
      status: 'error',
      error: 'missing-cwd',
      message: '该会话没有项目目录，无法还原相对路径',
    }
  }
  return { status: 'ready', path: joinCwd(cwd, parsed.path) }
}
