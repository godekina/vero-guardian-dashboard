import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import ActivityLogExport from '@/components/ActivityLogExport/ActivityLogExport';
import * as logger from '@/utils/logger';

jest.mock('@/utils/logger');

describe('ActivityLogExport', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('renders buttons and calls export', async () => {
    const exportSpy = jest.spyOn(logger, 'exportAuditLogs').mockResolvedValue({ saved: false, fileName: 'x', blob: new Blob(), exportFile: {} as any, saveMethod: 'none' });
    const { getByText } = render(<ActivityLogExport />);

    const btn = getByText(/Export Now|Exportar ahora|Export Now/);
    fireEvent.click(btn);

    await waitFor(() => expect(exportSpy).toHaveBeenCalled());
  });
});
