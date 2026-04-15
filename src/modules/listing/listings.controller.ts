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
  ParseFloatPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('Listings')
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

  @Get('geocode/address')
  @ApiOperation({ summary: 'Geocode an address to coordinates' })
  @ApiQuery({
    name: 'address',
    description: 'Address to geocode',
    example: '123 Main Street, Ho Chi Minh City',
  })
  async geocodeAddress(@Query('address') address: string) {
    return this.service.geocodeAddress(address);
  }

  @Get('search/nearby')
  @ApiOperation({ summary: 'Find listings near a location' })
  @ApiQuery({ name: 'lat', description: 'Latitude' })
  @ApiQuery({ name: 'lng', description: 'Longitude' })
  @ApiQuery({
    name: 'radius',
    description: 'Radius in km',
    required: false,
    example: 5,
  })
  async findNearby(
    @Query('lat', ParseFloatPipe) lat: number,
    @Query('lng', ParseFloatPipe) lng: number,
    @Query('radius', new ParseIntPipe({ optional: true })) radius?: number,
  ) {
    return this.service.findNearby(lat, lng, radius ?? 5);
  }

  @Get('search/by-address')
  @ApiOperation({ summary: 'Search listings by address location' })
  @ApiQuery({ name: 'address', description: 'Address to search near' })
  @ApiQuery({
    name: 'radius',
    description: 'Radius in km',
    required: false,
    example: 5,
  })
  async searchByAddress(
    @Query('address') address: string,
    @Query('radius', new ParseIntPipe({ optional: true })) radius?: number,
  ) {
    return this.service.searchByAddress(address, radius ?? 5);
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
