import { IsNumber, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReverseGeocodeRequestDto {
  @ApiProperty({ description: 'Latitude', example: 10.762622 })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: 'Longitude', example: 106.660172 })
  @IsNumber()
  lng: number;
}

export class ReverseGeocodeResponseDto {
  @ApiProperty({
    description: 'Formatted address',
    example: '123 Main Street, District 1, Ho Chi Minh City',
  })
  @IsString()
  address: string;

  @ApiProperty({
    description: 'Display name from OSM',
    example: '123 Main Street, District 1, Ho Chi Minh City, Vietnam',
  })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({
    description: 'City/Province',
    example: 'Ho Chi Minh City',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'District', example: 'District 1' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Additional OSM data' })
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}
