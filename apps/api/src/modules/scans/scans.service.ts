import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { CreateScanRequest, Project, Scan, ScanProgressResponse, ScanStatus } from '@visionqa/contracts';
import { detectorCatalog } from '@visionqa/detectors';
import type { ScanJobDispatcher } from '@visionqa/queue';
import { BullMqScanJobDispatcher } from '@visionqa/queue';
import { FirebaseScanRepository } from '@visionqa/database/firebase';
import { ProjectsService } from '../projects/projects.service.js';
import { ScanOrchestrator } from './scans.orchestrator.js';

const defaults = { browsers: ['chromium'] as const, viewports: [{ width: 1440, height: 900 }] };

@Injectable()
export class ScansService {
  private readonly scans = new FirebaseScanRepository();
  private readonly dispatcher: ScanJobDispatcher;
  private readonly orchestrator = new ScanOrchestrator();
  constructor(private readonly projects: ProjectsService) { this.dispatcher = new BullMqScanJobDispatcher(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379'); }

  private async context(ownerId: string, projectId: string, environmentId: string): Promise<{ project: Project; targetUrl: string }> { const project = await this.projects.find(ownerId, projectId); if (!project) throw new BadRequestException('Project not found.'); const environment = project.environments.find((item) => item.id === environmentId); if (!environment) throw new BadRequestException('Environment does not belong to this project.'); return { project, targetUrl: environment.baseUrl }; }
  private normalize(input: CreateScanRequest, project: Project): CreateScanRequest & { checks: string[]; requestedUrls: string[]; browsers: Scan['browsers']; viewports: Scan['viewports']; options: Scan['options'] } { const modules = input.module === 'full-scan' ? input.modules ?? [] : undefined; if (input.module === 'full-scan' && !modules?.length) throw new BadRequestException('Select at least one module for a full scan.'); const checks = modules ? [...new Set(modules.flatMap((item) => item.checks))] : [...new Set(input.checks ?? [])]; if (!checks.length) throw new BadRequestException('Select at least one check.'); for (const check of checks) { const metadata = detectorCatalog.find((item) => item.id === check); const module = modules?.find((item) => item.checks.includes(check))?.module ?? input.module; if (!metadata || metadata.module !== module) throw new BadRequestException(`Check "${check}" is not supported by the selected module.`); } const requestedUrls = input.requestedUrls?.length ? input.requestedUrls : [project.baseUrl]; return { ...input, ...(modules ? { modules } : {}), checks, requestedUrls, browsers: input.browsers?.length ? input.browsers : [...defaults.browsers], viewports: input.viewports?.length ? input.viewports : defaults.viewports, options: input.options ?? {} }; }
  async create(ownerId: string, projectId: string, input: CreateScanRequest): Promise<Scan> { const { project } = await this.context(ownerId, projectId, input.environmentId); const normalized = this.normalize(input, project); const scan = await this.scans.create(ownerId, project, normalized); if (!scan) throw new BadRequestException('Project not found.'); try { await this.orchestrator.dispatch(scan, project, this.dispatcher); console.info(JSON.stringify({ event: 'scan_created', scanId: scan.id, projectId, module: scan.module })); return scan; } catch (error) { await this.scans.updateStatus(ownerId, projectId, scan.id, 'failed', { failureCode: 'QUEUE_DISPATCH_FAILED', failureMessage: 'The scan could not be queued.' }); console.error(JSON.stringify({ event: 'queue_dispatch_failed', scanId: scan.id, projectId, module: scan.module })); throw new ServiceUnavailableException('The scan could not be queued. Please ensure the scan queue is available and try again.'); } }
  list(ownerId: string, projectId: string): Promise<Scan[] | null> { return this.scans.findByProject(ownerId, projectId); }
  get(ownerId: string, projectId: string, scanId: string): Promise<Scan | null> { return this.scans.findById(ownerId, projectId, scanId); }
  async progress(ownerId: string, projectId: string, scanId: string): Promise<ScanProgressResponse | null> { const scan = await this.get(ownerId, projectId, scanId); return scan ? { scanId, status: scan.status, progress: scan.progress } : null; }
  async cancel(ownerId: string, projectId: string, scanId: string): Promise<Scan | null> { const scan = await this.get(ownerId, projectId, scanId); if (!scan) return null; if (scan.status === 'completed' || scan.status === 'failed') throw new BadRequestException(`A ${scan.status} scan cannot be cancelled.`); if (scan.status === 'cancelled') return scan; const cancelled = await this.scans.updateStatus(ownerId, projectId, scanId, 'cancelled'); if (cancelled) console.info(JSON.stringify({ event: 'scan_cancelled', scanId, projectId, module: scan.module })); return cancelled; }
}
