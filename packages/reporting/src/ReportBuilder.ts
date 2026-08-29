export interface ReportBuilder {
  build(scanId: string): Promise<unknown>;
}
