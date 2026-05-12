import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './assets.entity';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [TypeOrmModule.forFeature([Asset]), EncryptionModule],
  providers: [AssetsService],
  controllers: [AssetsController],
})
export class AssetsModule {}
