/**
 * Seeds the two notification template rows the drill emails dispatch against.
 *
 * `POST dispatch/email` resolves a template by machine name and 404s when it is missing,
 * so without these rows every drill notification fails. The hook in education-service
 * catches that failure, which means nothing breaks loudly — no email simply goes out.
 *
 * The bodies live in code (`src/templates/drills/*.template.ts`), reached through the
 * renderer registry in `DispatchService.renderBody`, because both emails render arrays
 * that the row-based `{{key}}` substituter collapses to an empty string. These rows
 * therefore carry the identity and preference wiring, not the copy: `bodyHtml` is a
 * fallback that only surfaces if the registry entry is ever removed.
 *
 * Idempotent: re-running updates the row in place rather than failing on the unique
 * machine name, so it is safe to run on every deploy.
 *
 * Run with:
 *   DATABASE_URL=... npx tsx prisma/seed-drill-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TemplateSeed {
  machineName: string;
  title: string;
  help: string;
  settingsTitle: string;
  /**
   * `visible: true` puts the template in the user's notification preferences, so a
   * recipient can turn it off. Both drill emails are opt-outable: a student who does not
   * want assignment mail, and a teacher who does not want completion mail, are both
   * legitimate. Dispatch honours `TemplatePreference` only when the template is visible.
   */
  visible: boolean;
  bodyHtml: string;
}

const SEEDS: TemplateSeed[] = [
  {
    machineName: 'drill_assignment_assigned',
    title: 'New grammar practice assigned',
    settingsTitle: 'Grammar practice assigned to me',
    help: 'Sent to a student when a teacher assigns them a grammar drill.',
    visible: true,
    bodyHtml:
      '<p>{{title}}</p>\n' +
      '<!-- Body is rendered by renderAssignmentAssigned; this is a fallback only. -->',
  },
  {
    machineName: 'drill_assignment_completed',
    title: 'Your student finished their practice',
    settingsTitle: 'A student finished their grammar practice',
    help: 'Sent to a teacher when their student completes an assigned grammar drill. Carries no score.',
    visible: true,
    bodyHtml:
      '<p>{{title}}</p>\n' +
      '<!-- Body is rendered by renderAssignmentCompleted; this is a fallback only. -->',
  },
];

async function main(): Promise<void> {
  for (const seed of SEEDS) {
    const existing = await prisma.notificationTemplate.findUnique({
      where: { machineName: seed.machineName },
    });

    const row = await prisma.notificationTemplate.upsert({
      where: { machineName: seed.machineName },
      create: seed,
      update: {
        title: seed.title,
        settingsTitle: seed.settingsTitle,
        help: seed.help,
        visible: seed.visible,
        bodyHtml: seed.bodyHtml,
        // A row soft-deleted by an operator is brought back: dispatch filters on
        // `deletedAt: null`, so leaving it set would keep the template unreachable.
        deletedAt: null,
      },
    });

    console.log(
      `${existing ? 'updated' : 'created'} template ${row.machineName} (id=${row.id})`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error('drill template seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
