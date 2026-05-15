import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './assets.entity';
import { Liability } from '../liabilities/liabilities.entity';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { EncryptionModule } from '../encryption/encryption.module';
import { GoldModule } from '../gold/gold.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, Liability]), EncryptionModule, GoldModule, StockModule],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}