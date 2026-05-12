import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForecastService } from './forecast.service';
import { ForecastController } from './forecast.controller';
import { Liability } from '../liabilities/liabilities.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Liability])],
  providers: [ForecastService],
  controllers: [ForecastController],
})
export class ForecastModule {}
