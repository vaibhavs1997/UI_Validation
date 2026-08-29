import type { Detector, DetectorRegistry } from '@visionqa/detector-sdk';
export class InMemoryDetectorRegistry implements DetectorRegistry {
  private readonly detectors = new Map<string, Detector>();
  register(detector: Detector): void {
    this.detectors.set(detector.id, detector);
  }
  get(id: string): Detector | undefined {
    return this.detectors.get(id);
  }
  list(): Detector[] {
    return [...this.detectors.values()];
  }
}
