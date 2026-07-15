import { Module } from '@nestjs/common';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';
import { RazorpayService } from './razorpay.service';

@Module({
  controllers: [FeesController],
  providers: [FeesService, RazorpayService],
  exports: [FeesService, RazorpayService],
})
export class FeesModule {}
