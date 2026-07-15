import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(4096),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export class RefreshDto implements RefreshInput {
  @ApiProperty() refreshToken!: string;
}
