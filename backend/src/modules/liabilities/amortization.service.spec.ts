import { Test, TestingModule } from '@nestjs/testing';
import { AmortizationService } from './amortization.service';
import Decimal from 'decimal.js';

describe('AmortizationService', () => {
  let service: AmortizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AmortizationService],
    }).compile();
    service = module.get<AmortizationService>(AmortizationService);
  });

  it('should calculate equal-interest monthly payment correctly', () => {
    const schedule = service.generateEqualInterestSchedule(new Decimal('1000000'), new Decimal('0.049'), 360);
    expect(schedule).toHaveLength(360);
    expect(schedule[0].totalDue.toFixed(2)).toBe('5307.27');
    expect(schedule[0].interestDue.toFixed(2)).toBe('4083.33');
    expect(schedule[0].principalDue.toFixed(2)).toBe('1223.93');
  });

  it('should calculate equal-principal first month correctly', () => {
    const schedule = service.generateEqualPrincipalSchedule(new Decimal('1000000'), new Decimal('0.049'), 360);
    expect(schedule).toHaveLength(360);
    expect(schedule[0].principalDue.toFixed(2)).toBe('2777.78');
    expect(schedule[0].interestDue.toFixed(2)).toBe('4083.33');
    expect(schedule[0].totalDue.toFixed(2)).toBe('6861.11');
  });
});
