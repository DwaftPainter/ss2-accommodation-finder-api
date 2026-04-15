import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MapService } from './map.service';
import { GeocodeRequestDto, GeocodeResponseDto } from './dto/geocode.dto';
import {
  ReverseGeocodeRequestDto,
  ReverseGeocodeResponseDto,
} from './dto/reverse-geocode.dto';
import {
  SearchLocationRequestDto,
  SearchLocationResponseDto,
} from './dto/search.dto';

@ApiTags('Map - OpenStreetMap')
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('geocode')
  @ApiOperation({ summary: 'Geocode address to coordinates' })
  @ApiResponse({
    status: 200,
    description: 'Returns coordinates',
    type: GeocodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async geocode(
    @Query() query: GeocodeRequestDto,
  ): Promise<GeocodeResponseDto> {
    return this.mapService.geocode(query);
  }

  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocode coordinates to address' })
  @ApiResponse({
    status: 200,
    description: 'Returns address',
    type: ReverseGeocodeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Location not found' })
  async reverseGeocode(
    @Query() query: ReverseGeocodeRequestDto,
  ): Promise<ReverseGeocodeResponseDto> {
    return this.mapService.reverseGeocode(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for locations' })
  @ApiResponse({
    status: 200,
    description: 'Returns search results',
    type: SearchLocationResponseDto,
  })
  async searchLocations(
    @Query() query: SearchLocationRequestDto,
  ): Promise<SearchLocationResponseDto> {
    const results = await this.mapService.searchLocations(query);
    return { results };
  }
}
