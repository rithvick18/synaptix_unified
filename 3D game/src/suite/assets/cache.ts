/**
 * Reference-counted caches for GPU resources shared between scenes.
 *
 * A value is created the first time its key is acquired and disposed when the last holder
 * releases it, so building the same environment twice shares geometry and materials, and
 * disposing every scene leaves nothing behind.
 */
export interface Disposable { dispose(): void }

export class RefCache<T extends Disposable> {
  private entries = new Map<string, { value: T; refs: number }>()

  acquire(key: string, make: () => T): T {
    const entry = this.entries.get(key)
    if (entry) {
      entry.refs++
      return entry.value
    }
    const value = make()
    this.entries.set(key, { value, refs: 1 })
    return value
  }

  /** Looks without taking a reference. */
  peek(key: string): T | undefined {
    return this.entries.get(key)?.value
  }

  release(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    entry.refs--
    if (entry.refs <= 0) {
      this.entries.delete(key)
      entry.value.dispose()
    }
  }

  refs(key: string): number {
    return this.entries.get(key)?.refs ?? 0
  }

  get size(): number {
    return this.entries.size
  }
}
