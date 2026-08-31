export type FrontierItem = { url: string; normalizedUrl: string; depth: number; sourceUrl?: string };
export class CrawlFrontier {
  private readonly pending: FrontierItem[] = [];
  private readonly seen = new Set<string>();
  constructor(private readonly maxPages: number, private readonly maxDepth: number) {}
  add(item: FrontierItem): boolean { if (item.depth > this.maxDepth || this.seen.has(item.normalizedUrl) || this.seen.size >= this.maxPages) return false; this.seen.add(item.normalizedUrl); this.pending.push(item); return true; }
  next(): FrontierItem | undefined { return this.pending.shift(); }
  get size(): number { return this.pending.length; }
  get discovered(): number { return this.seen.size; }
}
