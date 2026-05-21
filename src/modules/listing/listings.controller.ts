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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SaveListingDto } from './dto/save-listing.dto';
import { QueryListingDto } from './dto/query-listing.dto';
import type { AuthenticatedRequest } from '../../common/types';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private service: ListingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FilesInterceptor('images'))
  @ApiOperation({ summary: 'Create a new listing with optional image uploads' })
  @ApiConsumes('multipart/form-data')
  create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateListingDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.service.create(req.user.userId, body, files);
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FilesInterceptor('images'))
  @ApiOperation({ summary: 'Upload images without creating a listing' })
  @ApiConsumes('multipart/form-data')
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    return this.service.uploadImages(files);
  }

  @Get()
  findAll(@Query() query: QueryListingDto) {
    return this.service.findAll(query);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMy(@Req() req: AuthenticatedRequest) {
    return this.service.getMyListings(req.user.userId);
  }

  @Get('locations')
  @ApiOperation({ summary: 'Get unique cities and districts for filters' })
  getLocations() {
    return this.service.getLocations();
  }

  @UseGuards(JwtAuthGuard)
  @Get('saved')
  @ApiOperation({ summary: 'Get user saved/favorite listings' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  getSavedListings(
    @Req() req: AuthenticatedRequest,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.getSavedListings(
      req.user.userId,
      page ?? 1,
      limit ?? 20,
    );
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a listing' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateListingDto,
  ) {
    return this.service.update(req.user.userId, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('saved')
  @ApiOperation({ summary: 'Save a listing to user favorites' })
  @ApiBody({ type: SaveListingDto })
  saveListing(@Req() req: AuthenticatedRequest, @Body() dto: SaveListingDto) {
    return this.service.saveListing(req.user.userId, dto.listingId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('saved/:listingId')
  @ApiOperation({ summary: 'Remove a listing from user favorites' })
  @ApiParam({ name: 'listingId', description: 'Listing ID to unsave' })
  unsaveListing(
    @Req() req: AuthenticatedRequest,
    @Param('listingId') listingId: string,
  ) {
    return this.service.unsaveListing(req.user.userId, listingId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('saved/check/:listingId')
  @ApiOperation({ summary: 'Check if a listing is saved by user' })
  @ApiParam({ name: 'listingId', description: 'Listing ID to check' })
  isListingSaved(
    @Req() req: AuthenticatedRequest,
    @Param('listingId') listingId: string,
  ) {
    return this.service.isListingSaved(req.user.userId, listingId);
  }
}
