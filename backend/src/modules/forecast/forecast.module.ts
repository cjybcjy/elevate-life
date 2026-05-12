import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForecastService } from './forecast.service';
import { ForecastController } from './forecast.controller';
import { Liability } from '../liabilities/liabilities.entity';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [TypeOrmModule.forFeature([Liability]), EncryptionModule],
  providers: [ForecastService],
  controllers: [ForecastController],
})
export class ForecastModule {}
