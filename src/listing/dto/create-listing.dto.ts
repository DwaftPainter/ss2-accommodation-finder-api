import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsPhoneNumber,
} from 'class-validator';

export class CreateListingDto {
  @IsString()
  title: string;

  @IsString()
  address: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  price: number;

  @IsNumber()
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
  utilities: string[];

  @IsArray()
  images: string[];

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber()
  contactPhone?: string;
}
