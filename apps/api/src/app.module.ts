import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';

@Controller('health')
class HealthController {
  @Get()
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'visionqa-api' };
  }
}

@Module({ imports: [AuthModule, ProjectsModule], controllers: [HealthController] })
export class AppModule {}
