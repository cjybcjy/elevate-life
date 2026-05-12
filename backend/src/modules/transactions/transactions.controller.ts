import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private service: TransactionsService) {}
  @Get() findAll(@Request() req: any, @Query('year') year?: string, @Query('month') month?: string) {
    if (year && month) return this.service.getMonthlySummary(req.user.userId, +year, +month);
    return this.service.findByUser(req.user.userId);
  }
  @Get('summary') getSummary(@Request() req: any, @Query('year') year: string, @Query('month') month: string) {
    return this.service.getMonthlySummary(req.user.userId, +year, +month);
  }
  @Post() create(@Request() req: any, @Body() dto: any) { return this.service.create(req.user.userId, dto); }
  @Patch(':id') update(@Request() req: any, @Param('id') id: string, @Body() dto: any) { return this.service.update(id, req.user.userId, dto); }
  @Delete(':id') delete(@Request() req: any, @Param('id') id: string) { return this.service.delete(id, req.user.userId); }
}
