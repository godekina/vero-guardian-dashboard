export interface ProofRecord {
  timestamp: string; // ISO date string
  taskId: string;
  proofHash: string;
  proofBlob: string; // raw proof data, can be JSON or binary string
}
