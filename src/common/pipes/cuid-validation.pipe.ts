import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const CUID_PATTERN = /^c[a-z0-9]{8,}$/i;

@Injectable()
export class CuidValidationPipe implements PipeTransform<string> {
  transform(value: string) {
    if (!CUID_PATTERN.test(value)) {
      throw new BadRequestException('Invalid CUID parameter');
    }

    return value;
  }
}
