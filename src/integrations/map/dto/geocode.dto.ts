import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeocodeRequestDto {
  @ApiProperty({
    description: 'Address to geocode',
    example: '123 Main Street, Ho Chi Minh City',
  })
  @IsString()
  address: string;
}

export class GeocodeResponseDto {
  @ApiProperty({ description: 'Latitude', example: 10.762622 })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 106.660172 })
  @IsNumber()
  lng: number;

  @ApiProperty({
    description: 'Formatted address',
    example: '123 Main Street, District 1, Ho Chi Minh City',
  })
  @IsString()
  formattedAddress: string;

  @ApiProperty({
    description: 'Display name from OSM',
    example: '123 Main Street, District 1, Ho Chi Minh City, Vietnam',
  })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({ description: 'Additional OSM data' })
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}
