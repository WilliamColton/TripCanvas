import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredImage } from '../types'
import { getImage, hashDataUrl, putImage, storeImage } from './db'

type RequestHandler = ((event?: { target: unknown }) => void) | null

class FakeIDBRequest<T = unknown> {
  result!: T
  error: Error | null = null
  onsuccess: RequestHandler = null
  onerror: RequestHandler = null
}

class FakeObjectStoreNames {
  constructor(private readonly stores: Map<string, Map<string, StoredImage>>) {}

  contains(name: string) {
    return this.stores.has(name)
  }
}

class FakeIDBObjectStore {
  constructor(private readonly rows: Map<string, StoredImage>) {}

  get(id: string) {
    const req = new FakeIDBRequest<StoredImage | undefined>()
    queueMicrotask(() => {
      const value = this.rows.get(id)
      req.result = value ? { ...value } : undefined
      req.onsuccess?.()
    })
    return req
  }

  put(image: StoredImage) {
    const req = new FakeIDBRequest<IDBValidKey>()
    queueMicrotask(() => {
      this.rows.set(image.id, { ...image })
      req.result = image.id
      req.onsuccess?.()
    })
    return req
  }
}

class FakeIDBTransaction {
  constructor(private readonly stores: Map<string, Map<string, StoredImage>>) {}

  objectStore(name: string) {
    let rows = this.stores.get(name)
    if (!rows) {
      rows = new Map()
      this.stores.set(name, rows)
    }
    return new FakeIDBObjectStore(rows)
  }
}

class FakeIDBDatabase {
  objectStoreNames: FakeObjectStoreNames

  constructor(private readonly stores: Map<string, Map<string, StoredImage>>) {
    this.objectStoreNames = new FakeObjectStoreNames(stores)
  }

  createObjectStore(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new Map())
  }

  transaction(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new Map())
    return new FakeIDBTransaction(this.stores)
  }
}

class FakeIDBOpenDBRequest extends FakeIDBRequest<FakeIDBDatabase> {
  onupgradeneeded: RequestHandler = null
}

class FakeIndexedDB {
  private readonly dbs = new Map<string, FakeIDBDatabase>()

  open(name: string) {
    const req = new FakeIDBOpenDBRequest()
    queueMicrotask(() => {
      let db = this.dbs.get(name)
      const isNew = !db
      if (!db) {
        db = new FakeIDBDatabase(new Map())
        this.dbs.set(name, db)
      }
      req.result = db
      if (isNew) req.onupgradeneeded?.({ target: req })
      req.onsuccess?.({ target: req })
    })
    return req
  }
}

describe('IndexedDB image cache utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(globalThis, 'indexedDB', {
      value: new FakeIndexedDB(),
      configurable: true,
    })
  })

  it('stores and reads images by id', async () => {
    const image: StoredImage = {
      id: 'img-1',
      dataUrl: 'data:image/png;base64,aaa',
      createdAt: 1,
      source: 'upload',
    }

    await expect(putImage(image)).resolves.toBe('img-1')

    await expect(getImage('img-1')).resolves.toEqual(image)
    await expect(getImage('missing')).resolves.toBeUndefined()
  })

  it('overwrites existing image records with the same id', async () => {
    await putImage({ id: 'img-1', dataUrl: 'data:image/png;base64,old', createdAt: 1, source: 'upload' })
    await putImage({ id: 'img-1', dataUrl: 'data:image/png;base64,new', createdAt: 2, source: 'generated' })

    await expect(getImage('img-1')).resolves.toEqual({
      id: 'img-1',
      dataUrl: 'data:image/png;base64,new',
      createdAt: 2,
      source: 'generated',
    })
  })

  it('hashes data URLs stably and distinguishes different data', async () => {
    const first = await hashDataUrl('data:image/png;base64,aaa')
    const second = await hashDataUrl('data:image/png;base64,aaa')
    const other = await hashDataUrl('data:image/png;base64,bbb')

    expect(first).toBe(second)
    expect(first).not.toBe(other)
  })

  it('storeImage writes each data URL once using the hash id', async () => {
    const id = await storeImage('data:image/png;base64,aaa', 'upload')
    const sameId = await storeImage('data:image/png;base64,aaa', 'generated')

    expect(sameId).toBe(id)
    await expect(getImage(id)).resolves.toEqual({
      id,
      dataUrl: 'data:image/png;base64,aaa',
      createdAt: expect.any(Number),
      source: 'upload',
    })
  })
})
