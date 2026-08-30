import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { qaModules, type CreateScanRequest } from '@visionqa/contracts';
import { detectorCatalog } from '@visionqa/detectors';
import { FirebaseSessionGuard, type AuthenticatedRequest } from '../auth/firebase-session.guard.js';
import { ScansService } from './scans.service.js';

const scanSchema = z.object({ environmentId: z.string().min(1), module: z.enum(qaModules), checks: z.array(z.string().min(1)).optional(), modules: z.array(z.object({ module: z.enum(qaModules).exclude(['full-scan']), checks: z.array(z.string().min(1)).min(1) })).optional(), requestedUrls: z.array(z.string().url()).optional(), browsers: z.array(z.enum(['chromium', 'firefox', 'webkit'])).optional(), viewports: z.array(z.object({ width: z.number().int().min(1).max(10000), height: z.number().int().min(1).max(10000), deviceScaleFactor: z.number().positive().optional() })).optional(), options: z.object({ maxPages: z.number().int().positive().max(10000).optional(), maxDepth: z.number().int().nonnegative().max(100).optional(), captureEvidence: z.boolean().optional() }).optional() });

@Controller('api/v1/projects/:projectId/scans')
@UseGuards(FirebaseSessionGuard)
export class ScansController {
  constructor(private readonly scans: ScansService) {}
  @Post() async create(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Body() body: unknown) { const parsed = scanSchema.safeParse(body); if (!parsed.success) throw new BadRequestException('Invalid scan request.'); return { scan: await this.scans.create(request.user!.id, projectId, parsed.data as CreateScanRequest) }; }
  @Get() async list(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) { const scans = await this.scans.list(request.user!.id, projectId); if (!scans) throw new BadRequestException('Project not found.'); return { scans }; }
  @Get(':scanId') async get(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('scanId') scanId: string) { const scan = await this.scans.get(request.user!.id, projectId, scanId); if (!scan) throw new BadRequestException('Scan not found.'); return { scan }; }
  @Get(':scanId/progress') async progress(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('scanId') scanId: string) { const progress = await this.scans.progress(request.user!.id, projectId, scanId); if (!progress) throw new BadRequestException('Scan not found.'); return progress; }
  @Post(':scanId/cancel') async cancel(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string, @Param('scanId') scanId: string) { const scan = await this.scans.cancel(request.user!.id, projectId, scanId); if (!scan) throw new BadRequestException('Scan not found.'); return { scan }; }
}

@Controller('api/v1/detectors')
export class DetectorsController {
  @Get() list() { return { detectors: detectorCatalog }; }
}
