import { Controller, Get, Module } from '@nestjs/common';

@Controller('health')
class HealthController {
  @Get()
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'visionqa-api' };
  }
}

@Module({ controllers: [HealthController] })
export class AppModule {}
