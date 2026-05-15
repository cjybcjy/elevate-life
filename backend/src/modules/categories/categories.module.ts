import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './categories.entity';
import { Transaction } from '../transactions/transactions.entity';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Transaction])],
  providers: [CategoriesService],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
