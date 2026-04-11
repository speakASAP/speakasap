import { Module } from '@nestjs/common';
import { AssetUserTestsController } from './asset-user-tests.controller';
import { AssetUserTestsService } from './asset-user-tests.service';

@Module({
  controllers: [AssetUserTestsController],
  providers: [AssetUserTestsService],
})
export class AssetUserTestsModule {}
