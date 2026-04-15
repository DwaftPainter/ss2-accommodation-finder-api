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

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  // --- Address fields (partial update of the nested Address record) ---

  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  // --- Listing fields ---

  @IsOptional()
  @IsInt()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  area?: number;

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  utilities?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsPhoneNumber('VN')
  contactPhone?: string;
}
