import type { QaModule, Severity } from '@visionqa/contracts';
export type DetectorCapability =
  | 'browser'
  | 'dom'
  | 'screenshot'
  | 'network'
  | 'crawlGraph'
  | 'accessibilityTree';
export interface DetectorRequirements {
  capabilities: DetectorCapability[];
}
export interface Evidence {
  id: string;
  kind: 'screenshot' | 'dom' | 'network' | 'console';
  uri?: string;
}
export interface Finding {
  detectorId: string;
  title: string;
  description: string;
  severity: Severity;
  evidence: Evidence[];
  fingerprint?: string;
}
export interface DetectorContext {
  scanId: string;
  module: QaModule;
  capabilities: ReadonlySet<DetectorCapability>;
  signal?: AbortSignal;
}
export interface Detector {
  id: string;
  module: QaModule;
  requirements: DetectorRequirements;
  run(context: DetectorContext): Promise<Finding[]>;
}
export interface DetectorRegistry {
  register(detector: Detector): void;
  get(id: string): Detector | undefined;
  list(module?: QaModule): Detector[];
}
