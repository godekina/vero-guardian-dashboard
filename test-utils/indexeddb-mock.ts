// Minimal IndexedDB mock for tests with basic get/put and transactions.
function createRequest(result?: any, error?: any) {
  const req: any = { onsuccess: null, onerror: null, result };
  return req;
}

class MockIDBDatabase {
  stores: Map<string, Map<any, any>> = new Map();

  createObjectStore(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    return {
      name,
    };
  }

  transaction(storeName: string, mode: 'readonly' | 'readwrite' = 'readonly') {
    const store = this.stores.get(storeName) ?? new Map();
    const that = this;

    const objectStore = () => ({
      get(key: any) {
        const req = createRequest();
        setTimeout(() => {
          req.result = store.get(key);
          if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
        }, 0);
        return req;
      },
      put(value: any) {
        const req = createRequest();
        setTimeout(() => {
          const id = value?.id ?? Math.random().toString(36).slice(2);
          store.set(id, value);
          // also allow using keyPath id
          if (value && typeof value === 'object' && 'id' in value) {
            store.set(value.id, value);
          }
          if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
        }, 0);
        return req;
      },
    });

    let oncomplete: (() => void) | null = null;
    let onerror: (() => void) | null = null;

    return {
      objectStore,
      get oncomplete() {
        return oncomplete;
      },
      set oncomplete(fn: any) {
        oncomplete = fn;
        // call complete on next tick to simulate commit
        setTimeout(() => {
          if (typeof oncomplete === 'function') oncomplete();
        }, 0);
      },
      get onerror() {
        return onerror;
      },
      set onerror(fn: any) {
        onerror = fn;
      },
    };
  }
}

export function installIndexedDBMock() {
  if (typeof (globalThis as any).indexedDB !== 'undefined') return;

  (globalThis as any).indexedDB = {
    open(name: string, version?: number) {
      const handlers: any = {};
      const req: any = {};
      let db: MockIDBDatabase | null = null;

      setTimeout(() => {
        db = new MockIDBDatabase();
        req.result = db;
        if (typeof handlers.onupgradeneeded === 'function') {
          try {
            handlers.onupgradeneeded({ target: { result: db } });
          } catch (e) {
            // ignore
          }
        }
        if (typeof handlers.onsuccess === 'function') {
          handlers.onsuccess({ target: req });
        }
      }, 0);

      return {
        get result() {
          return req.result;
        },
        set onsuccess(fn: any) {
          handlers.onsuccess = fn;
        },
        set onerror(fn: any) {
          handlers.onerror = fn;
        },
        set onupgradeneeded(fn: any) {
          handlers.onupgradeneeded = fn;
        },
      };
    },
  };
}

// Auto-install when required
try {
  installIndexedDBMock();
} catch {}
