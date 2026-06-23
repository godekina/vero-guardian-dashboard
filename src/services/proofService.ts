import { ProofRecord } from '@/types/proof';

/**
 * Mock fetch function for proof history.
 * In a real implementation this would call an API endpoint or indexer.
 */
export const fetchProofHistory = async (): Promise<ProofRecord[]> => {
  // Simulated network latency
  await new Promise((r) => setTimeout(r, 100));

  // Example mock data – replace with real data source later
  return [
    {
      timestamp: new Date().toISOString(),
      taskId: 'task-123',
      proofHash: '0xabcde12345f6789',
      proofBlob: '{"proof":"sample"}',
    },
    {
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      taskId: 'task-122',
      proofHash: '0xdeadbeefcafebabe',
      proofBlob: '{"proof":"older"}',
    },
  ];
};
