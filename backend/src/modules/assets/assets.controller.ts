import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssetsService } from './assets.service';

@Controller('assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
  constructor(private service: AssetsService) {}
  @Get() findAll(@Request() req: any) { return this.service.findByUser(req.user.userId); }
  @Get('summary') getSummary(@Request() req: any) { return this.service.getSummary(req.user.userId); }
  @Post() create(@Request() req: any, @Body() dto: any) { return this.service.create(req.user.userId, dto); }
  @Get(':id') findOne(@Request() req: any, @Param('id') id: string) { return this.service.findById(id, req.user.userId); }
  @Patch(':id') update(@Request() req: any, @Param('id') id: string, @Body() dto: any) { return this.service.update(id, req.user.userId, dto); }
  @Delete(':id') delete(@Request() req: any, @Param('id') id: string) { return this.service.delete(id, req.user.userId); }
}
