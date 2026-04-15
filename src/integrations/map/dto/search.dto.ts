import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchLocationRequestDto {
  @ApiProperty({
    description: 'Search query',
    example: 'District 1 Ho Chi Minh',
  })
  @IsString()
  query: string;

  @ApiPropertyOptional({ description: 'Limit number of results', example: 5 })
  @IsOptional()
  @IsNumber()
  limit?: number = 5;
}

export class SearchLocationResultDto {
  @ApiProperty({ description: 'Place ID' })
  @IsNumber()
  placeId: number;

  @ApiProperty({ description: 'Latitude' })
  @IsNumber()
  lat: number;

  @ApiProperty({ description: 'Longitude' })
  @IsNumber()
  lng: number;

  @ApiProperty({ description: 'Display name' })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({ description: 'Type of place' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Importance score' })
  @IsOptional()
  @IsNumber()
  importance?: number;
}

export class SearchLocationResponseDto {
  @ApiProperty({
    description: 'Search results',
    type: [SearchLocationResultDto],
  })
  @IsArray()
  results: SearchLocationResultDto[];
}
