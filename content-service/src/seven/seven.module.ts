import { Module } from "@nestjs/common";
import { SevenController } from "./seven.controller";
import { SevenService } from "./seven.service";

@Module({
  controllers: [SevenController],
  providers: [SevenService],
})
export class SevenModule {}
