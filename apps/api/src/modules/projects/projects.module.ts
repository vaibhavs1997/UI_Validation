import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FirebaseSessionGuard } from '../auth/firebase-session.guard.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

@Module({ imports: [AuthModule], controllers: [ProjectsController], providers: [ProjectsService, FirebaseSessionGuard] })
export class ProjectsModule {}
