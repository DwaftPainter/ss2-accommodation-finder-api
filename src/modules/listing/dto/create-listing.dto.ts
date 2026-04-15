import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsArray,
  IsPhoneNumber,
  IsPositive,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { ListingType } from '@prisma/client';

export class CreateListingDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  // --- Address fields (will be used to create a nested Address record) ---

  @IsString()
  street: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsString()
  district: string;

  @IsString()
  city: string;

  @IsString()
  province: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  // --- Listing fields ---

  @IsInt()
  @IsPositive()
  price: number;

  @IsNumber()
  @IsPositive()
  area: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  electricityFee?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  waterFee?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  utilities: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  images: string[];

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsPhoneNumber('VN')
  contactPhone?: string;
}
