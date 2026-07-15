import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

// StorageService is used from many domain modules (students, certificates,
// fees, ...), so we register it as Global to avoid a chain of explicit
// imports across the app.
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
