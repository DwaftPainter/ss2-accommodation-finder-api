import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { MapService } from './map.service';
import { of, throwError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AxiosResponse } from 'axios';

describe('MapService', () => {
  let service: MapService;
  let httpService: jest.Mocked<HttpService>;

  const mockHttpService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MapService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<MapService>(MapService);
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;
    jest.clearAllMocks();
  });

  describe('geocode', () => {
    it('should geocode address successfully', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: [
          {
            lat: '10.762622',
            lon: '106.660172',
            display_name: 'Ho Chi Minh City, Vietnam',
            address: {
              road: '123 Nguyen Trai',
              suburb: 'District 1',
              city: 'Ho Chi Minh City',
              country: 'Vietnam',
            },
          },
        ],
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.geocode({ address: '123 Nguyen Trai, HCMC' });

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('https://nominatim.openstreetmap.org/search?'),
        {
          headers: { 'User-Agent': 'AccommodationFinder/1.0' },
        },
      );
      expect(result).toEqual({
        lat: 10.762622,
        lng: 106.660172,
        formattedAddress: '123 Nguyen Trai, District 1, Ho Chi Minh City, Vietnam',
        displayName: 'Ho Chi Minh City, Vietnam',
        raw: mockResponse.data[0],
      });
    });

    it('should throw HttpException when address not found', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: [],
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      await expect(service.geocode({ address: 'Invalid Address' })).rejects.toThrow(
        new HttpException('Address not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw HttpException on HTTP error', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.geocode({ address: '123 Nguyen Trai' })).rejects.toThrow(
        new HttpException('Failed to geocode address', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });

    it('should use correct URL parameters', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: [{ lat: '10.0', lon: '106.0', display_name: 'Test' }],
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      await service.geocode({ address: 'Test Address' });

      const callUrl = httpService.get.mock.calls[0][0];
      // URLSearchParams uses + for spaces in query strings
      expect(callUrl).toContain('q=Test+Address');
      expect(callUrl).toContain('format=json');
      expect(callUrl).toContain('limit=1');
    });
  });

  describe('reverseGeocode', () => {
    it('should reverse geocode coordinates successfully', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: {
          display_name: '123 Nguyen Trai, District 1, Ho Chi Minh City',
          address: {
            road: 'Nguyen Trai',
            suburb: 'District 1',
            city: 'Ho Chi Minh City',
            town: null,
            village: null,
            county: null,
            state: null,
            country: 'Vietnam',
          },
        },
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.reverseGeocode({ lat: 10.762622, lng: 106.660172 });

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('https://nominatim.openstreetmap.org/reverse?'),
        {
          headers: { 'User-Agent': 'AccommodationFinder/1.0' },
        },
      );
      expect(result).toEqual({
        address: 'Nguyen Trai, District 1, Ho Chi Minh City, Vietnam',
        displayName: '123 Nguyen Trai, District 1, Ho Chi Minh City',
        city: 'Ho Chi Minh City',
        district: 'District 1',
        raw: mockResponse.data,
      });
    });

    it('should use town when city is not available', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: {
          display_name: 'Small Town, Vietnam',
          address: {
            road: 'Main Street',
            suburb: null,
            city: null,
            town: 'Small Town',
            village: null,
            county: null,
          },
        },
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.reverseGeocode({ lat: 10.0, lng: 106.0 });

      expect(result.city).toBe('Small Town');
    });

    it('should use village when city and town are not available', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: {
          display_name: 'Village Area, Vietnam',
          address: {
            road: 'Rural Road',
            suburb: null,
            city: null,
            town: null,
            village: 'Rural Village',
            county: 'County Name',
          },
        },
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.reverseGeocode({ lat: 10.0, lng: 106.0 });

      expect(result.city).toBe('Rural Village');
    });

    it('should use county as last resort for city', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: {
          display_name: 'County Area, Vietnam',
          address: {
            road: 'Road',
            suburb: null,
            city: null,
            town: null,
            village: null,
            county: 'County Name',
          },
        },
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.reverseGeocode({ lat: 10.0, lng: 106.0 });

      expect(result.city).toBe('County Name');
    });

    it('should throw HttpException when location not found', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: { error: 'Not found' },
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      await expect(service.reverseGeocode({ lat: 10.0, lng: 106.0 })).rejects.toThrow(
        new HttpException('Location not found', HttpStatus.NOT_FOUND),
      );
    });

    it('should throw HttpException on HTTP error', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.reverseGeocode({ lat: 10.0, lng: 106.0 })).rejects.toThrow(
        new HttpException('Failed to reverse geocode coordinates', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });
  });

  describe('searchLocations', () => {
    it('should search locations successfully', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: [
          {
            place_id: 1,
            lat: '10.762622',
            lon: '106.660172',
            display_name: 'Ho Chi Minh City',
            type: 'city',
            importance: 0.8,
          },
        ],
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.searchLocations({ query: 'Ho Chi Minh' });

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('https://nominatim.openstreetmap.org/search?'),
        {
          headers: { 'User-Agent': 'AccommodationFinder/1.0' },
        },
      );
      expect(result).toEqual([
        {
          placeId: 1,
          lat: 10.762622,
          lng: 106.660172,
          displayName: 'Ho Chi Minh City',
          type: 'city',
          importance: 0.8,
        },
      ]);
    });

    it('should search with custom limit', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: [],
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      await service.searchLocations({ query: 'Test', limit: 10 });

      const callUrl = httpService.get.mock.calls[0][0];
      expect(callUrl).toContain('limit=10');
    });

    it('should use default limit of 5', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: [],
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      await service.searchLocations({ query: 'Test' });

      const callUrl = httpService.get.mock.calls[0][0];
      expect(callUrl).toContain('limit=5');
    });

    it('should throw HttpException on HTTP error', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.searchLocations({ query: 'Test' })).rejects.toThrow(
        new HttpException('Failed to search locations', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });

    it('should handle empty results', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: [],
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.searchLocations({ query: 'NonExistent' });

      expect(result).toEqual([]);
    });

    it('should handle multiple results', async () => {
      const mockResponse: Partial<AxiosResponse> = {
        data: [
          { place_id: 1, lat: '10.0', lon: '106.0', display_name: 'Loc1', type: 'city', importance: 0.9 },
          { place_id: 2, lat: '11.0', lon: '107.0', display_name: 'Loc2', type: 'town', importance: 0.7 },
        ],
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const result = await service.searchLocations({ query: 'Test' });

      expect(result).toHaveLength(2);
      expect(result[0].placeId).toBe(1);
      expect(result[1].placeId).toBe(2);
    });
  });
});
