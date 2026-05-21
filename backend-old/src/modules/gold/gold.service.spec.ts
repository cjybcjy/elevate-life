import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Between } from 'typeorm';
import { GoldService } from './gold.service';
import { GoldPrice } from './gold.entity';

describe('GoldService', () => {
  let service: GoldService;
  let repoMock: { count: jest.Mock; findOne: jest.Mock; find: jest.Mock; save: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    repoMock = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((v) => Promise.resolve(v)),
      create: jest.fn().mockImplementation((v) => v),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoldService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://test-api.com') } },
        { provide: getRepositoryToken(GoldPrice), useValue: repoMock },
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

  it('should skip fetch when today already has data', async () => {
    repoMock.count.mockResolvedValueOnce(1);
    await service.fetchGoldPrice();
    expect(repoMock.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assetType: 'gold_au9999', recordedAt: expect.any(Object) }),
      }),
    );
    expect(repoMock.save).not.toHaveBeenCalled();
  });

  it('should query history with date range', async () => {
    await service.getHistory(7);
    expect(repoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assetType: 'gold_au9999', recordedAt: expect.any(Object) }),
        order: { recordedAt: 'DESC' },
      }),
    );
  });
});
