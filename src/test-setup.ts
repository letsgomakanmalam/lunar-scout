// Polyfill localStorage for Vitest's node environment.
// Zustand's persist middleware uses localStorage, which doesn't exist in Node.
class LocalStorageMock {
  private store: Record<string, string> = {}
  clear() { this.store = {} }
  getItem(key: string) { return this.store[key] ?? null }
  setItem(key: string, value: string) { this.store[key] = String(value) }
  removeItem(key: string) { delete this.store[key] }
  get length() { return Object.keys(this.store).length }
  key(i: number) { return Object.keys(this.store)[i] ?? null }
}

if (typeof localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: new LocalStorageMock(), writable: true })
}
if (typeof sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', { value: new LocalStorageMock(), writable: true })
}
