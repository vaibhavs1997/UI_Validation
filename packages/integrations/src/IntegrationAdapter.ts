export interface IntegrationAdapter {
  readonly provider: string;
  notify(payload: unknown): Promise<void>;
}
