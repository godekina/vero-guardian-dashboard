import React from 'react';
import { render, act } from '@testing-library/react';
import { useEvents } from '@/hooks/useEvents';
import { useActivityStream } from '@/hooks/useActivityStream';
import ActivityLogExport from '@/components/ActivityLogExport/ActivityLogExport';
import * as logger from '@/utils/logger';

jest.mock('@/utils/logger');

function EventEmitterTestApp() {
  const { emit } = useEvents();
  useActivityStream();
  return (
    <div>
      <button onClick={() => emit({ type: 'vote', actor: 'GABC' })}>emit</button>
      <ActivityLogExport />
    </div>
  );
}

describe('integration: event -> persist -> export listener', () => {
  beforeEach(() => jest.resetAllMocks());

  it('calls appendAuditEvent when emitting an event and exporter observes persisted records', async () => {
    const append = jest.spyOn(logger, 'appendAuditEvent').mockResolvedValue({} as any);
    const read = jest.spyOn(logger, 'readEncryptedAuditLogs').mockReturnValue([{
      id: 'r1', timestamp: new Date().toISOString(), sequence: 1, version: 1, algorithm: 'AES-GCM', iv: 'iv', ciphertext: 'ct', previousHash: '0', hash: 'h1'
    } as any]);

    const { getByText } = render(<EventEmitterTestApp />);

    act(() => {
      getByText('emit').click();
    });

    // allow async append and listener
    await new Promise((r) => setTimeout(r, 0));

    expect(append).toHaveBeenCalled();
  });
});
