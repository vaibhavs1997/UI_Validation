import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { FirebaseSessionGuard, type AuthenticatedRequest } from '../auth/firebase-session.guard.js';
import { ReportsService } from './reports.service.js';

const optionsSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  includeExecutiveSummary: z.boolean().optional(),
  includeModules: z.boolean().optional(),
  includeIssues: z.boolean().optional(),
  includeEvidenceReferences: z.boolean().optional(),
  includePassedChecks: z.boolean().optional(),
  includeTechnicalDetails: z.boolean().optional(),
  issueFilter: z.enum(['ALL', 'OPEN_ONLY']).optional(),
  severityMinimum: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
});

@Controller('api/v1/projects/:projectId')
@UseGuards(FirebaseSessionGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('scans/:scanId/reports')
  async generate(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('scanId') scanId: string,
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const parsed = optionsSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException('Invalid report options.');
    const report = await this.reports.generate(request.user!.id, projectId, scanId, parsed.data as import('@visionqa/contracts').ReportOptions, idempotencyKey);
    return { reportId: report.id, status: report.status };
  }

  @Get('reports')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const limit = query.limit ? Number(query.limit) : 25;
    if (!Number.isFinite(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('Invalid report limit.');
    const status = query.status === 'READY' || query.status === 'FAILED' ? query.status : undefined;
    if (query.status && !status) throw new BadRequestException('Invalid report status.');
    const result = await this.reports.list(request.user!.id, projectId, {
      ...(query.scanId ? { scanId: query.scanId } : {}),
      ...(status ? { status } : {}),
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
    if (!result) throw new NotFoundException('Project not found.');
    return result;
  }

  @Get('reports/:reportId')
  async detail(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
  ) {
    const report = await this.reports.get(request.user!.id, projectId, reportId);
    if (!report) throw new NotFoundException('Report not found.');
    return report;
  }

  @Delete('reports/:reportId')
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
  ) {
    if (!(await this.reports.delete(request.user!.id, projectId, reportId)))
      throw new NotFoundException('Report not found.');
    return { deleted: true };
  }
}
