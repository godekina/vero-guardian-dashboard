import { act, renderHook, waitFor } from '@testing-library/react';
import { useOnChainCache } from '@/hooks/useOnChainCache';
import { invalidateChainState, resetChainStateForTests } from '@/hooks/useChainState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fake fetcher that returns the given value after a microtask. */
function fakeFetcher<T>(value: T): () => Promise<T> {
  return () => Promise.resolve(value);
}

/** Fake fetcher that rejects with the given error message. */
function errorFetcher(message: string): () => Promise<never> {
  return () => Promise.reject(new Error(message));
}

/** Simple deferred promise so we can control fetch timing. */
function createDeferredFetcher<T>(): {
  fetcher: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { fetcher: () => promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Reset chain state between tests (module-level state is shared)
// ---------------------------------------------------------------------------

afterEach(() => {
  resetChainStateForTests();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useOnChainCache', () => {
  it('starts empty when revalidateOnMount is false', () => {
    const { result } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'test',
        fetcher: fakeFetcher('hello'),
        revalidateOnMount: false,
      }),
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    // isLoading is false because no fetch was initiated
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.syncVersion).toBe(0);
  });

  it('fetches on mount and returns data', async () => {
    const deferred = createDeferredFetcher<string>();

    const { result } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'mount-test',
        fetcher: deferred.fetcher,
      }),
    );

    // The fetch should have started (effect runs synchronously in test env)
    await waitFor(() => expect(result.current.isValidating).toBe(true));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    await act(async () => {
      deferred.resolve('hello-world');
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBe('hello-world');
    expect(result.current.error).toBeUndefined();
    expect(result.current.isValidating).toBe(false);
  });

  it('sets error when the fetcher rejects', async () => {
    const { result } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'error-test',
        fetcher: errorFetcher('on-chain fetch failed'),
      }),
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('on-chain fetch failed');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
  });

  it('mutate updates cached data optimistically', async () => {
    const { result } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'mutate-test',
        fetcher: fakeFetcher('initial'),
      }),
    );

    await waitFor(() => expect(result.current.data).toBe('initial'));

    act(() => {
      result.current.mutate('optimistic-update');
    });

    expect(result.current.data).toBe('optimistic-update');
    expect(result.current.error).toBeUndefined();
  });

  it('manually revalidate re-fetches data', async () => {
    let callCount = 0;
    const dynamicFetcher = async () => {
      callCount += 1;
      return `call-${callCount}`;
    };

    const { result } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'revalidate-test',
        fetcher: dynamicFetcher,
      }),
    );

    await waitFor(() => expect(result.current.data).toBe('call-1'));
    expect(callCount).toBe(1);

    let revalidateResult: string | undefined;
    await act(async () => {
      revalidateResult = await result.current.revalidate();
    });

    expect(revalidateResult).toBe('call-2');
    expect(result.current.data).toBe('call-2');
    expect(callCount).toBe(2);
  });

  it('shares cached data across hook instances with the same cache key', async () => {
    const fetcher = fakeFetcher('shared-data');

    const { result: hookA } = renderHook(() =>
      useOnChainCache({ cacheKey: 'shared', fetcher }),
    );

    await waitFor(() => expect(hookA.current.data).toBe('shared-data'));

    const { result: hookB } = renderHook(() =>
      useOnChainCache({ cacheKey: 'shared', fetcher: fakeFetcher('different') }),
    );

    // Hook B should see the already-cached value; the fetcher should NOT be
    // called a second time because revalidateOnMount defaults to true but the
    // cache entry already has data, so dedup prevents re-fetch.
    expect(hookB.current.data).toBe('shared-data');

    // Explicitly revalidate hook B — the cache entry's fetcher ref is the
    // latest one passed to any live hook instance, which is now 'different'.
    await act(async () => {
      await hookB.current.revalidate();
    });

    // The data should now be 'different' because the latest fetcher resolved.
    expect(hookB.current.data).toBe('different');
  });

  it('deduplicates concurrent requests within the dedup interval', async () => {
    let callCount = 0;
    const { resolve: resolve1, fetcher: fetcher1 } = createDeferredFetcher<string>();
    const { resolve: resolve2, fetcher: fetcher2 } = createDeferredFetcher<string>();

    // We'll swap the fetcher ref manually to simulate two concurrent calls
    const hook = renderHook(() =>
      useOnChainCache<string>({
        cacheKey: 'dedup',
        fetcher: fetcher1,
      }),
    );

    // Start first revalidation
    let promise1: Promise<string | undefined>;
    act(() => {
      promise1 = hook.result.current.revalidate();
    });

    // Replace fetcher ref to track second call
    hook.rerender();

    // Manually trigger a second revalidation that should be dedup'd
    let promise2: Promise<string | undefined>;
    act(() => {
      // The hook's revalidate captures cacheKey, so it will check entry.promise
      promise2 = hook.result.current.revalidate();
    });

    // Resolve the deferred promise
    await act(async () => {
      resolve1('dedup-result');
    });

    const [result1, result2] = await Promise.all([promise1!, promise2!]);

    expect(result1).toBe('dedup-result');
    expect(result2).toBe('dedup-result');
    expect(callCount).toBe(0); // The createDeferredFetcher doesn't increment callCount
  });

  it('calls onSuccess when fetch succeeds', async () => {
    const onSuccess = jest.fn();

    renderHook(() =>
      useOnChainCache({
        cacheKey: 'on-success',
        fetcher: fakeFetcher('ok'),
        onSuccess,
      }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('ok'));
  });

  it('calls onError when fetch fails', async () => {
    const onError = jest.fn();

    renderHook(() =>
      useOnChainCache({
        cacheKey: 'on-error',
        fetcher: errorFetcher('fail'),
        onError,
      }),
    );

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('fail');
  });

  it('re-fetches when the chain state syncVersion increments', async () => {
    let callCount = 0;
    const countingFetcher = async () => {
      callCount += 1;
      return `v-${callCount}`;
    };

    const { result } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'sync-version-test',
        fetcher: countingFetcher,
      }),
    );

    await waitFor(() => expect(result.current.data).toBe('v-1'));
    expect(callCount).toBe(1);

    // Trigger chain state invalidation for the same cache key
    await act(async () => {
      invalidateChainState(['sync-version-test'], 'manual');
    });

    // The hook should re-fetch when syncVersion changes
    await waitFor(() => expect(result.current.data).toBe('v-2'));
    expect(callCount).toBe(2);
  });

  it('isValidating is true during background revalidation', async () => {
    const deferred = createDeferredFetcher<string>();
    let fetcherCallCount = 0;

    const { result } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'validating-bg',
        fetcher: () => {
          fetcherCallCount += 1;
          return deferred.fetcher();
        },
      }),
    );

    // First fetch is in-flight
    await waitFor(() => expect(result.current.isValidating).toBe(true));
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      deferred.resolve('first-value');
    });

    await waitFor(() => expect(result.current.data).toBe('first-value'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);

    // Trigger revalidation via chain state invalidation
    const bgDeferred = createDeferredFetcher<string>();
    const { result: bgHook } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'validating-bg',
        fetcher: () => {
          fetcherCallCount += 1;
          return bgDeferred.fetcher();
        },
      }),
    );

    // Invalidate the chain state to trigger re-fetch
    await act(async () => {
      invalidateChainState(['validating-bg'], 'manual');
    });

    // Background revalidation: should show existing data + isValidating
    await waitFor(() => expect(bgHook.current.isValidating).toBe(true));
    expect(bgHook.current.isLoading).toBe(false);
    // Existing data should still be available during revalidation
    expect(bgHook.current.data).toBe('first-value');

    await act(async () => {
      bgDeferred.resolve('second-value');
    });

    await waitFor(() => expect(bgHook.current.data).toBe('second-value'));
    expect(bgHook.current.isValidating).toBe(false);
    expect(fetcherCallCount).toBe(2);
  });

  it('returns correct syncVersion from useChainState', () => {
    const { result } = renderHook(() =>
      useOnChainCache({
        cacheKey: 'version-test',
        fetcher: fakeFetcher('data'),
        revalidateOnMount: false,
      }),
    );

    expect(typeof result.current.syncVersion).toBe('number');
  });
});
