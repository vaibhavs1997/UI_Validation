import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { DetectorsController, EvidenceController, IssuesController, ScansController } from './scans.controller.js';
import { ScansService } from './scans.service.js';
@Module({ imports: [AuthModule, ProjectsModule], controllers: [ScansController, EvidenceController, DetectorsController, IssuesController], providers: [ScansService] })
export class ScansModule {}
