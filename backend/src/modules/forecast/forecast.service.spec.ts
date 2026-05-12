import { Test, TestingModule } from '@nestjs/testing';
import { ForecastService } from './forecast.service';
import Decimal from 'decimal.js';

describe('ForecastService', () => {
  let service: ForecastService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ForecastService],
    }).compile();
    service = module.get<ForecastService>(ForecastService);
  });

  it('should calculate WACR correctly', () => {
    const liabilities = [
      { balance: new Decimal('1000000'), rate: new Decimal('0.049') },
      { balance: new Decimal('200000'), rate: new Decimal('0.065') },
    ];
    const wacr = service.calculateWACR(liabilities);
    expect(wacr.toFixed(4)).toBe('0.0517');
  });

  it('should generate 12-month cashflow forecast', () => {
    const forecast = service.simulateCashflow({
      monthlyIncome: new Decimal('30000'),
      monthlyExpense: new Decimal('20000'),
      months: 12,
    });
    expect(forecast.months).toHaveLength(12);
    expect(forecast.runwayMonths).toBeGreaterThan(0);
    expect(forecast.warningLevel).toBe('green');
  });
});
