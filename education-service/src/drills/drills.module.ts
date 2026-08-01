import { Module } from '@nestjs/common';
import { AuthClientModule } from '../auth-client/auth-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AssignmentsRepository } from './assignments.repository';
import { DrillsController } from './drills.controller';
import { InternalDrillsController } from './internal-drills.controller';
import { DrillAssignmentsService } from './runner/assignments.service';
import { RunnerService } from './runner/runner.service';
import { SelfDrillService } from './runner/self-drill.service';

/**
 * Track B shipped `AssignmentsRepository` with no module, so it was unreachable
 * at runtime (Track B handoff note 4). This module wires it, the runner and the
 * two controllers.
 *
 * NOT provided here, deliberately: `SelfDrillService`'s `DrillSetsClient` and
 * `StudentProgressClient`, and `DrillsController`'s `DrillIdentityResolver`.
 * All three are cross-service boundaries owned by other tracks (D for the
 * content-service client, H/I for legacy identity). Binding them to stubs here
 * would silently ship a broken runtime; leaving them unbound makes the missing
 * dependency a startup error instead. See the status file.
 */
@Module({
  imports: [PrismaModule, AuthClientModule],
  controllers: [DrillsController, InternalDrillsController],
  providers: [AssignmentsRepository, RunnerService, SelfDrillService, DrillAssignmentsService],
  exports: [AssignmentsRepository, DrillAssignmentsService],
})
export class DrillsModule {}
