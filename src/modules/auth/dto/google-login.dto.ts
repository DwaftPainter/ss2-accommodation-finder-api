import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  sub?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  given_name?: string;

  @IsOptional()
  @IsString()
  family_name?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  picture?: string;

  @IsOptional()
  @IsBoolean()
  email_verified?: boolean;

  @IsOptional()
  @IsString()
  authProvider?: string;
}
