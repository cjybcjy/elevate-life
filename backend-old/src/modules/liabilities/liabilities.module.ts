import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Liability } from './liabilities.entity';
import { DebtMilestone } from './debt-milestones.entity';
import { Transaction } from '../transactions/transactions.entity';
import { LiabilitiesService } from './liabilities.service';
import { LiabilitiesController } from './liabilities.controller';
import { AmortizationService } from './amortization.service';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [TypeOrmModule.forFeature([Liability, DebtMilestone, Transaction]), EncryptionModule],
  providers: [LiabilitiesService, AmortizationService],
  controllers: [LiabilitiesController],
})
export class LiabilitiesModule {}
