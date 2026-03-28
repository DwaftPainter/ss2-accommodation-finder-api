import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GeocodeRequestDto, GeocodeResponseDto } from './dto/geocode.dto';
import {
  ReverseGeocodeRequestDto,
  ReverseGeocodeResponseDto,
} from './dto/reverse-geocode.dto';
import {
  SearchLocationRequestDto,
  SearchLocationResultDto,
} from './dto/search.dto';

@Injectable()
export class MapService {
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org';
  private readonly userAgent = 'AccommodationFinder/1.0';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Geocode an address to get lat/lng coordinates
   */
  async geocode(request: GeocodeRequestDto): Promise<GeocodeResponseDto> {
    const params = new URLSearchParams({
      q: request.address,
      format: 'json',
      limit: '1',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.nominatimUrl}/search?${params.toString()}`,
          {
            headers: {
              'User-Agent': this.userAgent,
            },
          },
        ),
      );

      const results = response.data;

      if (!results || results.length === 0) {
        throw new HttpException('Address not found', HttpStatus.NOT_FOUND);
      }

      const result = results[0];
      return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        formattedAddress: this.formatAddress(result),
        displayName: result.display_name,
        raw: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to geocode address',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Reverse geocode lat/lng to get address
   */
  async reverseGeocode(
    request: ReverseGeocodeRequestDto,
  ): Promise<ReverseGeocodeResponseDto> {
    const params = new URLSearchParams({
      lat: request.lat.toString(),
      lon: request.lng.toString(),
      format: 'json',
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.nominatimUrl}/reverse?${params.toString()}`,
          {
            headers: {
              'User-Agent': this.userAgent,
            },
          },
        ),
      );

      const result = response.data;

      if (!result || !result.display_name) {
        throw new HttpException('Location not found', HttpStatus.NOT_FOUND);
      }

      const address = result.address || {};

      return {
        address: this.formatAddress(result),
        displayName: result.display_name,
        city: address.city || address.town || address.village || address.county,
        district: address.suburb || address.district || address.city_district,
        raw: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to reverse geocode coordinates',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Search for locations by query
   */
  async searchLocations(
    request: SearchLocationRequestDto,
  ): Promise<SearchLocationResultDto[]> {
    const params = new URLSearchParams({
      q: request.query,
      format: 'json',
      limit: (request.limit ?? 5).toString(),
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.nominatimUrl}/search?${params.toString()}`,
          {
            headers: {
              'User-Agent': this.userAgent,
            },
          },
        ),
      );

      const results = response.data || [];

      return results.map((result: any) => ({
        placeId: result.place_id,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        type: result.type,
        importance: result.importance,
      }));
    } catch (error) {
      throw new HttpException(
        'Failed to search locations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Format address from Nominatim response
   */
  private formatAddress(result: any): string {
    const address = result.address || {};
    const parts = [
      address.road || address.pedestrian || address.footway,
      address.suburb || address.district,
      address.city || address.town || address.village,
      address.state,
      address.country,
    ].filter(Boolean);

    return parts.join(', ');
  }
}
