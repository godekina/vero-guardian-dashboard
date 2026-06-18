'use client';

/**
 * Re-exports the GasHeatmap visualisation from the canonical implementation.
 * Place this component inside the analytics/ module so callers can import from
 * `@/components/analytics/GasHeatmap` or `@/components/analytics`.
 */
export {
  default,
  GAS_METRICS,
  METRIC_LABEL_KEYS,
  DEFAULT_GAS_USAGE,
  buildHeatmap,
  findHotspots,
  formatGas,
} from '@/components/GasHeatmap/GasHeatmap';

export type {
  FunctionGasUsage,
  GasMetric,
  GasHotspot,
  HeatmapCell,
} from '@/components/GasHeatmap/GasHeatmap';
