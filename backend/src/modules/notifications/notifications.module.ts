import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SmsChannel } from './channels/sms.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';
import { PushChannel } from './channels/push.channel';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SmsChannel, WhatsappChannel, PushChannel],
  exports: [NotificationsService, SmsChannel, WhatsappChannel, PushChannel],
})
export class NotificationsModule {}
