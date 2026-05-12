import { Module } from '@nestjs/common';
import { ForecastService } from './forecast.service';
import { ForecastController } from './forecast.controller';

@Module({
  providers: [ForecastService],
  controllers: [ForecastController],
})
export class ForecastModule {}
