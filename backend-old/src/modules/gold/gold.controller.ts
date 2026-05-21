import { Controller, Get, Query } from '@nestjs/common';
import { GoldService } from './gold.service';

@Controller('gold')
export class GoldController {
  constructor(private service: GoldService) {}

  @Get('price')
  async getPrice() {
    return this.service.getCurrentPrice();
  }

  @Get('history')
  async getHistory(@Query('days') days?: string) {
    return this.service.getHistory(days ? +days : 30);
  }

  @Get('refresh')
  async refreshPrice() {
    await this.service.fetchGoldPrice();
    return this.service.getCurrentPrice();
  }
}
