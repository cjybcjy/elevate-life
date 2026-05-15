import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transactions.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction]), AssetsModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
