import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoldPrice } from './gold.entity';
import { GoldService } from './gold.service';
import { GoldController } from './gold.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GoldPrice])],
  providers: [GoldService],
  controllers: [GoldController],
  exports: [GoldService],
})
export class GoldModule {}
