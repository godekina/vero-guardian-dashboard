import { renderHook, act } from '@testing-library/react';
import { useEvents } from '@/hooks/useEvents';
import { useActivityStream } from '@/hooks/useActivityStream';
import * as logger from '@/utils/logger';

jest.mock('@/utils/logger');

describe('useActivityStream', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('mirrors protocol events (non-transaction) to audit logger', async () => {
    const appendSpy = jest.spyOn(logger, 'appendAuditEvent').mockResolvedValue({} as any);

    const wrapper = ({ children }: any) => children;

    const { result: eventsHook } = renderHook(() => useEvents(), { wrapper });

    renderHook(() => useActivityStream(), { wrapper });

    act(() => {
      eventsHook.current.emit({ type: 'vote', actor: 'GABC', resource: 'pr', resourceId: '1' });
    });

    // give async append a tick
    await new Promise((r) => setTimeout(r, 0));

    expect(appendSpy).toHaveBeenCalled();
  });
});
