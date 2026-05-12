import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoldService } from './gold.service';
import { GoldPrice } from './gold.entity';

describe('GoldService', () => {
  let service: GoldService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoldService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://test-api.com') } },
        { provide: getRepositoryToken(GoldPrice), useValue: {} },
      ],
    }).compile();
    service = module.get<GoldService>(GoldService);
  });

  it('should detect anomalous price and reject', () => {
    expect(service.isAnomalous(500, 450)).toBe(true); // > 5% jump
  });

  it('should accept normal price fluctuation', () => {
    expect(service.isAnomalous(455, 450)).toBe(false); // ~1.1% jump
  });
});
