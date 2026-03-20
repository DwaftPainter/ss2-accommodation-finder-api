import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsPhoneNumber,
} from 'class-validator';

export class UpdateListingDto {
  @IsString()
  @IsOptional()
  title: string;

  @IsString()
  @IsOptional()
  address: string;

  @IsNumber()
  @IsOptional()
  lat: number;

  @IsNumber()
  @IsOptional()
  lng: number;

  @IsNumber()
  @IsOptional()
  price: number;

  @IsNumber()
  @IsOptional()
  area: number;

  @IsOptional()
  @IsNumber()
  electricityFee?: number;

  @IsOptional()
  @IsNumber()
  waterFee?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsOptional()
  utilities: string[];

  @IsArray()
  @IsOptional()
  images: string[];

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber()
  contactPhone?: string;
}
