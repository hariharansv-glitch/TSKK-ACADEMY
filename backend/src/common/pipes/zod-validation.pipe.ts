import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';

/**
 * Route-level Zod validation pipe.
 *
 * Usage:
 *   @UsePipes(new ZodValidationPipe(mySchema))
 *   @Body() body: MyBodyType
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'ValidationError',
          message: 'Request validation failed',
          issues: err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        });
      }
      throw err;
    }
  }
}
