import { Module } from '@nestjs/common';
import { BeltsController } from './belts.controller';
import { BeltsService } from './belts.service';
import { CertificatesModule } from '@modules/certificates/certificates.module';

@Module({
  imports: [CertificatesModule],
  controllers: [BeltsController],
  providers: [BeltsService],
  exports: [BeltsService],
})
export class BeltsModule {}
