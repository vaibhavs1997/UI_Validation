import { Module } from '@nestjs/common';
import { ScansModule } from '../scans/scans.module.js';
import {
  SchedulesController,
  SchedulerInternalController,
} from './schedules.controller.js';
import { SchedulesService } from './schedules.service.js';

@Module({
  imports: [ScansModule],
  controllers: [SchedulesController, SchedulerInternalController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
