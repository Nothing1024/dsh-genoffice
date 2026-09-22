const memory = new Map<string, string>()
const storage: Storage = {
  get length() {
    return memory.size
  },
  clear() {
    memory.clear()
  },
  getItem(key: string) {
    return memory.has(key) ? memory.get(key)! : null
  },
  key(index: number) {
    return Array.from(memory.keys())[index] ?? null
  },
  removeItem(key: string) {
    memory.delete(key)
  },
  setItem(key: string, value: string) {
    memory.set(String(key), String(value))
  },
}
const target = typeof globalThis !== 'undefined' ? globalThis : undefined
if (target) {
  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: storage,
  })
  const w = (target as { window?: unknown }).window
  if (w && w !== target) {
    Object.defineProperty(w, 'localStorage', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: storage,
    })
  }
}
