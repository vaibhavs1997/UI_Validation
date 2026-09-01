import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import {
  DetectorsController,
  EvidenceController,
  IssuesController,
  ScansController,
} from './scans.controller.js';
import { ScansService } from './scans.service.js';
import { CustomChecksController } from './custom-checks.controller.js';
import { CustomChecksService } from './custom-checks.service.js';
@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [
    ScansController,
    EvidenceController,
    DetectorsController,
    IssuesController,
    CustomChecksController,
  ],
  providers: [ScansService, CustomChecksService],
  exports: [ScansService],
})
export class ScansModule {}
