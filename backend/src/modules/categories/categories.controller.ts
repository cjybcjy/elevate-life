import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoriesService } from './categories.service';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private service: CategoriesService) {}

  @Get() findAll(@Request() req: any) { return this.service.findByUser(req.user.userId); }
  @Post() create(@Request() req: any, @Body() dto: any) { return this.service.create(req.user.userId, dto); }
  @Patch(':id') update(@Request() req: any, @Param('id') id: string, @Body() dto: any) { return this.service.update(id, req.user.userId, dto); }
  @Delete(':id') delete(@Request() req: any, @Param('id') id: string) { return this.service.delete(id, req.user.userId); }
}
