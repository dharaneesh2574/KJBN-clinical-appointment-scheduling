import { BadRequestException, PipeTransform } from '@nestjs/common';
export class EmptyBodyPipe implements PipeTransform<unknown, undefined> {
  transform(value: unknown): undefined {
    if (
      value === undefined ||
      (typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0)
    )
      return undefined;
    throw new BadRequestException({ code: 'VALIDATION_FAILED' });
  }
}
