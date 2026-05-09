import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SaveListingDto {
  @ApiProperty({ description: 'Listing ID to save' })
  @IsString()
  @IsNotEmpty()
  listingId: string;
}
