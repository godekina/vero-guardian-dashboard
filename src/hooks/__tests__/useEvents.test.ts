import { act, renderHook } from '@testing-library/react';
import { useEvents } from '@/hooks/useEvents';

describe('useEvents', () => {
  it('starts with an empty timeline', () => {
    const { result } = renderHook(() => useEvents());
    expect(result.current.timeline).toEqual([]);
  });

  it('emits an event that appears in the timeline', () => {
    const { result } = renderHook(() => useEvents());

    act(() => {
      result.current.emit({ type: 'vote', actor: 'GABC', resource: 'pr', resourceId: '42' });
    });

    expect(result.current.timeline).toHaveLength(1);
    expect(result.current.timeline[0]).toMatchObject({
      type: 'vote',
      actor: 'GABC',
      resource: 'pr',
      resourceId: '42',
    });
    expect(result.current.timeline[0].id).toBeTruthy();
    expect(result.current.timeline[0].timestamp).toBeTruthy();
  });

  it('prepends newer events (newest first)', () => {
    const { result } = renderHook(() => useEvents());

    act(() => { result.current.emit({ type: 'task_registered' }); });
    act(() => { result.current.emit({ type: 'vote' }); });

    expect(result.current.timeline[0].type).toBe('vote');
    expect(result.current.timeline[1].type).toBe('task_registered');
  });

  it('multiple hook instances share the bus', () => {
    const hook1 = renderHook(() => useEvents());
    const hook2 = renderHook(() => useEvents());

    act(() => { hook1.result.current.emit({ type: 'transaction' }); });

    expect(hook2.result.current.timeline).toHaveLength(1);
    expect(hook2.result.current.timeline[0].type).toBe('transaction');

    hook1.unmount();
    hook2.unmount();
  });

  it('clears the timeline', () => {
    const { result } = renderHook(() => useEvents());

    act(() => { result.current.emit({ type: 'vote' }); });
    act(() => { result.current.clear(); });

    expect(result.current.timeline).toEqual([]);
  });

  it('respects maxEvents option', () => {
    const { result } = renderHook(() => useEvents({ maxEvents: 3 }));

    act(() => {
      for (let i = 0; i < 5; i++) {
        result.current.emit({ type: 'vote', resourceId: i });
      }
    });

    expect(result.current.timeline).toHaveLength(3);
  });

  it('strips sensitive metadata keys', () => {
    const { result } = renderHook(() => useEvents());

    act(() => {
      result.current.emit({
        type: 'vote',
        metadata: { secret: 'abc', password: 'xyz', prId: 42 },
      });
    });

    const { metadata } = result.current.timeline[0];
    expect(metadata).not.toHaveProperty('secret');
    expect(metadata).not.toHaveProperty('password');
    expect(metadata).toMatchObject({ prId: 42 });
  });

  it('sanitizes unknown event type to "unknown"', () => {
    const { result } = renderHook(() => useEvents());

    act(() => {
      result.current.emit({ type: '' });
    });

    expect(result.current.timeline[0].type).toBe('unknown');
  });
});
