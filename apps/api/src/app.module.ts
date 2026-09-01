import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { ScansModule } from './modules/scans/scans.module.js';
import { SchedulesModule } from './modules/schedules/schedules.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';

@Controller('health')
class HealthController {
  @Get()
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'visionqa-api' };
  }
}

@Module({
  imports: [AuthModule, ProjectsModule, ScansModule, SchedulesModule, ReportsModule],
  controllers: [HealthController],
})
export class AppModule {}
