import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Liability } from './liabilities.entity';
import { DebtMilestone } from './debt-milestones.entity';
import { Transaction } from '../transactions/transactions.entity';
import { AmortizationService } from './amortization.service';
import { EncryptionService } from '../encryption/encryption.service';

@Injectable()
export class LiabilitiesService {
  constructor(
    @InjectRepository(Liability) private liabilityRepo: Repository<Liability>,
    @InjectRepository(DebtMilestone) private milestoneRepo: Repository<DebtMilestone>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private amortizationService: AmortizationService,
    private encryptionService: EncryptionService,
  ) {}

  async findByUser(userId: string): Promise<Liability[]> {
    return this.liabilityRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findById(id: string, userId: string): Promise<Liability | null> {
    return this.liabilityRepo.findOne({ where: { id, userId } });
  }

  async create(userId: string, data: any): Promise<Liability> {
    const principalStr = new Decimal(data.principal).toFixed(4);
    const balanceStr = new Decimal(data.currentBalance || data.principal).toFixed(4);
    const shouldEncrypt = this.encryptionService.shouldEncrypt(principalStr);
    const liability = this.liabilityRepo.create({
      ...data,
      principal: shouldEncrypt ? this.encryptionService.encrypt(principalStr) : principalStr,
      currentBalance: shouldEncrypt ? this.encryptionService.encrypt(balanceStr) : balanceStr,
      isEncrypted: shouldEncrypt,
      userId,
    });
    const saved = await this.liabilityRepo.save(liability);
    const savedArray = Array.isArray(saved) ? saved : [saved];
    await this.generateSchedule(savedArray[0]);
    return savedArray[0];
  }

  async update(id: string, userId: string, data: any): Promise<Liability> {
    if (data.principal !== undefined) {
      const str = new Decimal(data.principal).toFixed(4);
      data.principal = this.encryptionService.shouldEncrypt(str) ? this.encryptionService.encrypt(str) : str;
      data.isEncrypted = this.encryptionService.shouldEncrypt(str);
    }
    if (data.currentBalance !== undefined) {
      const str = new Decimal(data.currentBalance).toFixed(4);
      data.currentBalance = this.encryptionService.shouldEncrypt(str) ? this.encryptionService.encrypt(str) : str;
    }
    await this.liabilityRepo.update({ id, userId }, data);
    const updated = await this.liabilityRepo.findOneOrFail({ where: { id, userId } });
    if (data.interestRate || data.termMonths || data.principal) {
      await this.generateSchedule(updated);
    }
    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const count = await this.txRepo.count({
      where: [
        { fromAccountId: id, userId },
        { toAccountId: id, userId },
      ],
    });
    if (count > 0) {
      throw new ConflictException(`该负债存在 ${count} 笔关联交易，无法删除`);
    }
    await this.milestoneRepo.delete({ liabilityId: id });
    await this.liabilityRepo.delete({ id, userId });
  }

  async getSchedule(liabilityId: string, userId: string): Promise<DebtMilestone[]> {
    const liability = await this.liabilityRepo.findOne({ where: { id: liabilityId, userId } });
    if (!liability) return [];
    return this.milestoneRepo.find({ where: { liabilityId }, order: { monthIndex: 'ASC' } });
  }

  private async generateSchedule(liability: Liability): Promise<void> {
    await this.milestoneRepo.delete({ liabilityId: liability.id });
    const principalStr = liability.isEncrypted ? this.encryptionService.decrypt(liability.principal.slice(4)) : liability.principal;
    const principal = new Decimal(principalStr);
    const rate = new Decimal(liability.interestRate);
    let schedule: any[];
    if (liability.paymentMethod === 'equal_interest') {
      schedule = this.amortizationService.generateEqualInterestSchedule(principal, rate, liability.termMonths);
    } else {
      schedule = this.amortizationService.generateEqualPrincipalSchedule(principal, rate, liability.termMonths);
    }
    const milestones = schedule.slice(0, 12).map((s: any) => {
      const startDate = new Date(liability.startDate);
      const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + s.monthIndex, 1);
      return this.milestoneRepo.create({
        liabilityId: liability.id, monthIndex: s.monthIndex, dueDate,
        principalDue: s.principalDue, interestDue: s.interestDue, totalDue: s.totalDue, remainingBalance: s.remainingBalance,
      });
    });
    await this.milestoneRepo.save(milestones);
  }
}
