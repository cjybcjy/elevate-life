import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ForecastService } from './forecast.service';
import Decimal from 'decimal.js';

@Controller('forecast')
@UseGuards(JwtAuthGuard)
export class ForecastController {
  constructor(private service: ForecastService) {}

  @Get('wacr') async getWACR(@Request() req: any) {
    return { wacr: 0 };
  }

  @Post('cashflow') async simulateCashflow(@Request() req: any, @Body() dto: any) {
    return this.service.simulateCashflow({
      monthlyIncome: new Decimal(dto.monthlyIncome || 0),
      monthlyExpense: new Decimal(dto.monthlyExpense || 0),
      months: dto.months || 12,
      incomeAdjustment: dto.incomeAdjustment,
      oneOffExpenses: (dto.oneOffExpenses || []).map((e: any) => ({ month: e.month, amount: new Decimal(e.amount) })),
    });
  }
}
