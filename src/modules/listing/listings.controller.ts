import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from 'src/modules/auth/jwt.guard';

@Controller('listings')
export class ListingsController {
  constructor(private service: ListingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req, @Body() body) {
    return this.service.create(req.user.userId, body);
  }

  @Get()
  findAll(@Query() query) {
    return this.service.findAll(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMy(@Req() req) {
    return this.service.getMyListings(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Req() req, @Param('id') id: string, @Body() body) {
    return this.service.update(req.user.userId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
