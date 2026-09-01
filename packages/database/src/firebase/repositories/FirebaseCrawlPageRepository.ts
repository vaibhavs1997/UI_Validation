import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import type { CrawlPage, CrawlStatus } from '@visionqa/contracts';
import type { CrawlPageRepository } from '../../contracts/storage.js';
import { getFirestoreDb } from '../firebase-admin.js';

const iso = (value: unknown): string | undefined =>
  value && typeof (value as Timestamp).toDate === 'function'
    ? (value as Timestamp).toDate().toISOString()
    : typeof value === 'string'
      ? value
      : undefined;
const pageId = (url: string) =>
  createHash('sha256').update(url).digest('hex').slice(0, 40);
function map(id: string, data: Record<string, unknown>): CrawlPage {
  const fetchedAt = iso(data.fetchedAt);
  return {
    id,
    scanId: String(data.scanId),
    projectId: String(data.projectId),
    url: String(data.url),
    normalizedUrl: String(data.normalizedUrl),
    depth: Number(data.depth ?? 0),
    ...(typeof data.statusCode === 'number'
      ? { statusCode: data.statusCode }
      : {}),
    ...(typeof data.contentType === 'string'
      ? { contentType: data.contentType }
      : {}),
    ...(typeof data.title === 'string' ? { title: data.title } : {}),
    ...(typeof data.sourceUrl === 'string'
      ? { sourceUrl: data.sourceUrl }
      : {}),
    redirectChain: Array.isArray(data.redirectChain)
      ? data.redirectChain.map(String)
      : [],
    discoveredAt: iso(data.discoveredAt) ?? new Date(0).toISOString(),
    ...(fetchedAt ? { fetchedAt } : {}),
    ...(typeof data.durationMs === 'number'
      ? { durationMs: data.durationMs }
      : {}),
    crawlStatus: String(data.crawlStatus ?? 'DISCOVERED') as CrawlStatus,
    ...(typeof data.failureCode === 'string'
      ? { failureCode: data.failureCode }
      : {}),
    ...(typeof data.failureMessage === 'string'
      ? { failureMessage: data.failureMessage }
      : {}),
  };
}
export class FirebaseCrawlPageRepository implements CrawlPageRepository {
  private pages(projectId: string, scanId: string) {
    return getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .collection('scans')
      .doc(scanId)
      .collection('pages');
  }
  async createDiscovered(
    input: Omit<CrawlPage, 'id' | 'discoveredAt' | 'crawlStatus'> &
      Partial<Pick<CrawlPage, 'discoveredAt'>>,
  ): Promise<CrawlPage> {
    const ref = this.pages(input.projectId, input.scanId).doc(
      pageId(input.normalizedUrl),
    );
    const existing = await ref.get();
    if (!existing.exists)
      await ref.create({
        ...input,
        id: ref.id,
        crawlStatus: 'DISCOVERED',
        discoveredAt: input.discoveredAt ?? FieldValue.serverTimestamp(),
      });
    const saved = await ref.get();
    return map(ref.id, saved.data()!);
  }
  async markFetched(
    scanId: string,
    normalizedUrl: string,
    fields: Pick<
      CrawlPage,
      'statusCode' | 'contentType' | 'title' | 'durationMs' | 'redirectChain'
    >,
  ): Promise<void> {
    const snapshot = await getFirestoreDb()
      .collectionGroup('pages')
      .where('scanId', '==', scanId)
      .where('normalizedUrl', '==', normalizedUrl)
      .limit(1)
      .get();
    if (!snapshot.empty)
      await snapshot.docs[0]!.ref.set(
        {
          ...fields,
          crawlStatus: 'FETCHED',
          fetchedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }
  async markFailed(
    scanId: string,
    normalizedUrl: string,
    failureCode: string,
    failureMessage: string,
  ): Promise<void> {
    const snapshot = await getFirestoreDb()
      .collectionGroup('pages')
      .where('scanId', '==', scanId)
      .where('normalizedUrl', '==', normalizedUrl)
      .limit(1)
      .get();
    if (!snapshot.empty)
      await snapshot.docs[0]!.ref.set(
        { crawlStatus: 'FAILED', failureCode, failureMessage },
        { merge: true },
      );
  }
  async markSkipped(
    scanId: string,
    normalizedUrl: string,
    reason: string,
  ): Promise<void> {
    const snapshot = await getFirestoreDb()
      .collectionGroup('pages')
      .where('scanId', '==', scanId)
      .where('normalizedUrl', '==', normalizedUrl)
      .limit(1)
      .get();
    if (!snapshot.empty)
      await snapshot.docs[0]!.ref.set(
        {
          crawlStatus: 'SKIPPED',
          failureCode: 'UNSUPPORTED_CONTENT_TYPE',
          failureMessage: reason,
        },
        { merge: true },
      );
  }
  async existsByNormalizedUrl(
    scanId: string,
    normalizedUrl: string,
  ): Promise<boolean> {
    const snapshot = await getFirestoreDb()
      .collectionGroup('pages')
      .where('scanId', '==', scanId)
      .where('normalizedUrl', '==', normalizedUrl)
      .limit(1)
      .get();
    return !snapshot.empty;
  }
  async findByScan(
    ownerId: string,
    projectId: string,
    scanId: string,
    options: {
      status?: CrawlStatus;
      depth?: number;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ pages: CrawlPage[]; nextCursor?: string }> {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId)
      return { pages: [] };
    const pageCollection = this.pages(projectId, scanId);
    let query = pageCollection
      .orderBy('discoveredAt', 'desc')
      .limit(Math.min(options.limit ?? 50, 100)) as FirebaseFirestore.Query;
    if (options.cursor) {
      const cursor = await pageCollection.doc(options.cursor).get();
      if (cursor.exists) query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const pages = snapshot.docs
      .map((doc) => map(doc.id, doc.data()))
      .filter(
        (page) =>
          (!options.status || page.crawlStatus === options.status) &&
          (options.depth === undefined || page.depth === options.depth),
      );
    return {
      pages,
      ...(snapshot.size === Math.min(options.limit ?? 50, 100) &&
      snapshot.docs.at(-1)
        ? { nextCursor: snapshot.docs.at(-1)!.id }
        : {}),
    };
  }
  async summary(ownerId: string, projectId: string, scanId: string) {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId)
      return {
        pagesDiscovered: 0,
        pagesFetched: 0,
        pagesFailed: 0,
        maxDepthReached: 0,
        durationMs: 0,
      };
    const pages = (await this.pages(projectId, scanId).get()).docs.map((doc) =>
      map(doc.id, doc.data()),
    );
    return {
      pagesDiscovered: pages.length,
      pagesFetched: pages.filter((page) => page.crawlStatus === 'FETCHED')
        .length,
      pagesFailed: pages.filter((page) => page.crawlStatus === 'FAILED').length,
      maxDepthReached: pages.reduce(
        (max, page) => Math.max(max, page.depth),
        0,
      ),
      durationMs: pages.reduce((sum, page) => sum + (page.durationMs ?? 0), 0),
    };
  }
  async saveQuality(
    projectId: string,
    scanId: string,
    type: 'robots' | 'sitemap',
    data: Record<string, unknown>,
  ): Promise<void> {
    await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .collection('scans')
      .doc(scanId)
      .collection('crawlQuality')
      .doc(type)
      .set(
        { ...data, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
  }
  async saveSitemapEntries(
    projectId: string,
    scanId: string,
    urls: string[],
  ): Promise<void> {
    const collection = getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .collection('scans')
      .doc(scanId)
      .collection('sitemapEntries');
    for (let offset = 0; offset < urls.length; offset += 400) {
      const batch = getFirestoreDb().batch();
      for (const url of urls.slice(offset, offset + 400))
        batch.set(
          collection.doc(pageId(url)),
          {
            pageUrl: url,
            normalizedUrl: url,
            status: 'DISCOVERED',
            sourceSitemap: 'sitemap',
            discoveredAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      await batch.commit();
    }
  }
  async sitemapUrls(
    ownerId: string,
    projectId: string,
    scanId: string,
    limit = 100,
  ): Promise<string[]> {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId) return [];
    const snapshot = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .collection('scans')
      .doc(scanId)
      .collection('sitemapEntries')
      .limit(Math.min(limit, 50000))
      .get();
    return snapshot.docs.map((doc) =>
      String(doc.data().normalizedUrl ?? doc.data().pageUrl),
    );
  }
  async allNormalizedUrls(
    ownerId: string,
    projectId: string,
    scanId: string,
  ): Promise<string[]> {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId) return [];
    const snapshot = await this.pages(projectId, scanId).get();
    return snapshot.docs.map((doc) => String(doc.data().normalizedUrl));
  }
  async findByScanForWorker(scanId: string): Promise<CrawlPage[]> {
    const snapshot = await getFirestoreDb()
      .collectionGroup('pages')
      .where('scanId', '==', scanId)
      .get();
    return snapshot.docs.map((doc) => map(doc.id, doc.data()));
  }
  async getQuality(
    ownerId: string,
    projectId: string,
    scanId: string,
    type: 'robots' | 'sitemap',
  ): Promise<Record<string, unknown> | null> {
    const project = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .get();
    if (!project.exists || project.data()?.createdBy !== ownerId) return null;
    const result = await getFirestoreDb()
      .collection('projects')
      .doc(projectId)
      .collection('scans')
      .doc(scanId)
      .collection('crawlQuality')
      .doc(type)
      .get();
    return result.exists ? (result.data() ?? null) : null;
  }
}
