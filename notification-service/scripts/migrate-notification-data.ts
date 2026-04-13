/**
 * Phase-4 notification DB ETL: read-only legacy portal Postgres → speakasap_notification_db (Prisma).
 *
 *   npm run migrate:notification-data -- --dry-run
 *   npm run migrate:notification-data -- --load
 *   npm run migrate:notification-data -- --dry-run --write-docs
 *   npm run migrate:notification-data -- --verify-post-load
 *
 * Env (speakasap/.env): NOTIFICATION_LEGACY_DATABASE_URL, NOTIFICATION_DATABASE_URL (or DATABASE_URL).
 * Optional: NOTIFICATION_PORTAL_ROOT — directory containing `notifications/templates/...` (default: sibling `speakasap-portal`).
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const SPEAKASAP_ROOT = join(process.cwd(), '..');

const NS = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');

function ts(): string {
  return new Date().toISOString();
}

function log(msg: string, meta?: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: ts(), msg, ...meta }));
}

function loadEnvFrom(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const eq = t.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function uuidV5(name: string): string {
  const hash = createHash('sha1');
  hash.update(NS);
  hash.update(name, 'utf8');
  const buf = hash.digest().subarray(0, 16);
  buf[6] = (buf[6]! & 0x0f) | 0x50;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function portalTemplatesRoot(): string {
  const fromEnv = process.env.NOTIFICATION_PORTAL_ROOT?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return join(SPEAKASAP_ROOT, '..', 'speakasap-portal');
}

function readTemplateBodyHtml(machineName: string): { body: string; source: string } {
  const root = portalTemplatesRoot();
  const rel = join('notifications', 'templates', 'notifications', 'emails', `${machineName}.html`);
  const abs = join(root, rel);
  if (existsSync(abs)) {
    return { body: readFileSync(abs, 'utf8'), source: rel.replace(/\\/g, '/') };
  }
  const marker = `<!-- ETL: missing template file for machine_name=${machineName} (expected ${rel}) -->\n`;
  return { body: marker, source: 'missing' };
}

function splitRecipients(raw: string | null): string[] {
  if (!raw || !raw.trim()) {
    return [];
  }
  return raw.trim().split(/\s+/).filter(Boolean);
}

async function legacyTableExists(client: pg.Client, table: string): Promise<boolean> {
  const r = await client.query<{ ok: number }>(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [table],
  );
  return r.rowCount !== null && r.rowCount > 0;
}

type LegacyCounts = {
  groups: number;
  templates: number;
  templateGroupLinks: number;
  groupManagerLinks: number;
  letters: number;
  lettersOrphanTemplate: number;
  commonEmail: number;
  templatePrefs: number;
  templatePrefsOrphan: number;
  inApp: number;
};

async function collectLegacyCounts(client: pg.Client): Promise<LegacyCounts> {
  const one = async (sql: string): Promise<number> => {
    const r = await client.query<{ c: string }>(sql);
    return parseInt(r.rows[0]!.c, 10);
  };
  const tTpl = await legacyTableExists(client, 'notifications_notificationtemplate');
  const tGrp = await legacyTableExists(client, 'notifications_notificationgroup');
  const tLetter = await legacyTableExists(client, 'notifications_letter');
  const tCe = await legacyTableExists(client, 'notifications_commonemailsettings');
  const tNs = await legacyTableExists(client, 'notifications_notificationsettings');
  const tIn = await legacyTableExists(client, 'notifications_notification');
  const tM2mTg = await legacyTableExists(client, 'notifications_notificationtemplate_groups');
  const tM2mGm = await legacyTableExists(client, 'notifications_notificationgroup_managers');

  let lettersOrphanTemplate = 0;
  if (tLetter && tTpl) {
    lettersOrphanTemplate = await one(
      `SELECT COUNT(*)::text AS c FROM notifications_letter l
       WHERE NOT EXISTS (SELECT 1 FROM notifications_notificationtemplate t WHERE t.id = l.template_id)`,
    );
  }

  let templatePrefsOrphan = 0;
  if (tNs && tTpl) {
    templatePrefsOrphan = await one(
      `SELECT COUNT(*)::text AS c FROM notifications_notificationsettings s
       WHERE NOT EXISTS (SELECT 1 FROM notifications_notificationtemplate t WHERE t.id = s.notification_id)`,
    );
  }

  return {
    groups: tGrp ? await one('SELECT COUNT(*)::text AS c FROM notifications_notificationgroup') : 0,
    templates: tTpl ? await one('SELECT COUNT(*)::text AS c FROM notifications_notificationtemplate') : 0,
    templateGroupLinks: tM2mTg
      ? await one('SELECT COUNT(*)::text AS c FROM notifications_notificationtemplate_groups')
      : 0,
    groupManagerLinks: tM2mGm
      ? await one('SELECT COUNT(*)::text AS c FROM notifications_notificationgroup_managers')
      : 0,
    letters: tLetter ? await one('SELECT COUNT(*)::text AS c FROM notifications_letter') : 0,
    lettersOrphanTemplate,
    commonEmail: tCe ? await one('SELECT COUNT(*)::text AS c FROM notifications_commonemailsettings') : 0,
    templatePrefs: tNs ? await one('SELECT COUNT(*)::text AS c FROM notifications_notificationsettings') : 0,
    templatePrefsOrphan,
    inApp: tIn ? await one('SELECT COUNT(*)::text AS c FROM notifications_notification') : 0,
  };
}

async function verifyPostLoad(envPath: string): Promise<void> {
  loadEnvFrom(envPath);
  const targetUrl = process.env.NOTIFICATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!targetUrl) {
    throw new Error('NOTIFICATION_DATABASE_URL or DATABASE_URL is required for --verify-post-load.');
  }
  process.env.DATABASE_URL = targetUrl;
  const prisma = new PrismaClient();
  try {
    const [tpl, grp, letters, prefs, ce, inapp, tg, gm] = await Promise.all([
      prisma.notificationTemplate.count(),
      prisma.notificationGroup.count(),
      prisma.letter.count(),
      prisma.templatePreference.count(),
      prisma.commonEmailSettings.count(),
      prisma.inAppNotification.count(),
      prisma.templateGroup.count(),
      prisma.notificationGroupManager.count(),
    ]);
    const orphanLetters = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM letters l
      WHERE NOT EXISTS (SELECT 1 FROM notification_templates t WHERE t.id = l.template_id)`;
    const orphanPrefs = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM template_preferences p
      WHERE NOT EXISTS (SELECT 1 FROM notification_templates t WHERE t.id = p.template_id)`;
    log('post_load_counts', {
      notificationTemplates: tpl,
      notificationGroups: grp,
      templateGroupLinks: tg,
      groupManagerLinks: gm,
      letters,
      letterOrphansMissingTemplate: Number(orphanLetters[0]!.c),
      templatePreferences: prefs,
      templatePrefOrphansMissingTemplate: Number(orphanPrefs[0]!.c),
      commonEmailSettings: ce,
      inAppNotifications: inapp,
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const envPath = join(SPEAKASAP_ROOT, '.env');

  if (args.includes('--verify-post-load')) {
    await verifyPostLoad(envPath);
    return;
  }

  const doLoad = args.includes('--load');
  const writeDocs = args.includes('--write-docs');
  const dryRunArg = args.includes('--dry-run');
  if (!doLoad && !dryRunArg && !writeDocs) {
    log('hint', {
      msg: 'Pass --dry-run and/or --load (add --write-docs to append docs/refactoring/NOTIFICATION_DATA_MIGRATION_LOG.md).',
    });
  }

  loadEnvFrom(envPath);

  const legacyUrl = process.env.NOTIFICATION_LEGACY_DATABASE_URL;
  const targetUrl = process.env.NOTIFICATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!legacyUrl) {
    throw new Error('NOTIFICATION_LEGACY_DATABASE_URL is required (read-only legacy portal DB).');
  }
  if (!targetUrl) {
    throw new Error('NOTIFICATION_DATABASE_URL or DATABASE_URL is required for target DB.');
  }

  log('notification_etl_start', { dryRun: !doLoad, load: doLoad });

  const legacy = new pg.Client({ connectionString: legacyUrl, statement_timeout: 300000 });
  await legacy.connect();
  log('legacy_connected', {});

  const counts = await collectLegacyCounts(legacy);
  log('legacy_counts', counts as unknown as Record<string, unknown>);

  const legacyGroupIdToUuid = new Map<number, string>();
  const legacyTemplateIdToUuid = new Map<number, string>();

  const groupRows = await legacy
    .query<{ id: number; machine_name: string; title: string; created: Date }>(
      `SELECT id, machine_name, title, created FROM notifications_notificationgroup ORDER BY id`,
    )
    .catch(() => ({ rows: [] as { id: number; machine_name: string; title: string; created: Date }[] }));

  const templateRows = await legacy
    .query<{
      id: number;
      machine_name: string;
      title: string;
      visible: boolean;
      help: string | null;
      settings_title: string | null;
    }>(
      `SELECT id, machine_name, title, visible, help, settings_title
       FROM notifications_notificationtemplate ORDER BY id`,
    )
    .catch(() => ({ rows: [] as never[] }));

  let m2mTemplateGroups = { rows: [] as { notificationtemplate_id: number; notificationgroup_id: number }[] };
  if (await legacyTableExists(legacy, 'notifications_notificationtemplate_groups')) {
    m2mTemplateGroups = await legacy.query(
      `SELECT notificationtemplate_id, notificationgroup_id
       FROM notifications_notificationtemplate_groups`,
    );
  }

  let m2mGroupManagers = { rows: [] as { notificationgroup_id: number; user_id: number }[] };
  if (
    (await legacyTableExists(legacy, 'notifications_notificationgroup_managers')) &&
    (await legacyTableExists(legacy, 'employees_manager'))
  ) {
    m2mGroupManagers = await legacy.query(
      `SELECT ngm.notificationgroup_id, em.user_id
       FROM notifications_notificationgroup_managers ngm
       INNER JOIN employees_manager em ON em.id = ngm.manager_id`,
    );
  } else {
    log('group_managers_skipped', { reason: 'missing_m2m_or_employees_manager' });
  }

  const letterRows = await legacy
    .query<{
      id: number;
      template_id: number;
      user_id: number;
      text: string | null;
      created: Date;
      sent: Date | null;
      recipients: string | null;
      from_email: string | null;
    }>(
      `SELECT id, template_id, user_id, text, created, sent, recipients, from_email
       FROM notifications_letter ORDER BY id`,
    )
    .catch(() => ({ rows: [] as never[] }));

  const inAppRows = await legacy
    .query<{
      id: number;
      user_id: number;
      read: boolean;
      text: string;
      link: string | null;
      created: Date;
    }>(
      `SELECT id, user_id, read, text, link, created FROM notifications_notification ORDER BY id`,
    )
    .catch(() => ({ rows: [] as never[] }));

  const ceRows = await legacy
    .query<{ user_id: number; email_enabled: boolean; do_not_contact: boolean | null }>(
      `SELECT ces.user_id, ces.email_enabled, COALESCE(st.do_not_contact, false) AS do_not_contact
       FROM notifications_commonemailsettings ces
       LEFT JOIN students_student st ON st.user_id = ces.user_id`,
    )
    .catch(() => {
      return legacy
        .query<{ user_id: number; email_enabled: boolean; do_not_contact: boolean | null }>(
          `SELECT user_id, email_enabled, false AS do_not_contact FROM notifications_commonemailsettings`,
        )
        .catch(() => ({ rows: [] as never[] }));
    });

  const prefRows = await legacy
    .query<{ user_id: number; notification_id: number; active: boolean }>(
      `SELECT user_id, notification_id, active FROM notifications_notificationsettings`,
    )
    .catch(() => ({ rows: [] as never[] }));

  const templateIdSet = new Set(templateRows.rows.map((r) => r.id));
  const lettersSkipped = letterRows.rows.filter((l) => !templateIdSet.has(l.template_id));
  const lettersToMigrate = letterRows.rows.filter((l) => templateIdSet.has(l.template_id));
  const prefsSkipped = prefRows.rows.filter((p) => !templateIdSet.has(p.notification_id));
  const prefsToMigrate = prefRows.rows.filter((p) => templateIdSet.has(p.notification_id));

  log('transform_precheck', {
    lettersTotal: letterRows.rows.length,
    lettersSkippedMissingTemplate: lettersSkipped.length,
    lettersToMigrate: lettersToMigrate.length,
    prefsTotal: prefRows.rows.length,
    prefsSkippedMissingTemplate: prefsSkipped.length,
    prefsToMigrate: prefsToMigrate.length,
    templateHtmlRoot: portalTemplatesRoot(),
  });

  let missingTemplateFiles = 0;
  for (const t of templateRows.rows) {
    const { source } = readTemplateBodyHtml(t.machine_name);
    if (source === 'missing') {
      missingTemplateFiles += 1;
    }
  }
  log('template_file_inventory', { missingTemplateFiles, templates: templateRows.rows.length });

  let prisma: PrismaClient | null = null;
  if (doLoad) {
    process.env.DATABASE_URL = targetUrl;
    prisma = new PrismaClient();
  }

  if (doLoad && prisma) {
    log('load_batch_start', { step: 'notification_groups' });
    for (const row of groupRows.rows) {
      const id = uuidV5(`speakasap:notification-service:group:${row.id}`);
      legacyGroupIdToUuid.set(row.id, id);
      await prisma.notificationGroup.upsert({
        where: { machineName: row.machine_name },
        create: {
          id,
          machineName: row.machine_name,
          title: row.title,
          createdAt: row.created,
        },
        update: { title: row.title },
      });
    }
    log('load_batch_complete', { step: 'notification_groups', rows: groupRows.rows.length });

    log('load_batch_start', { step: 'notification_templates' });
    for (const row of templateRows.rows) {
      const id = uuidV5(`speakasap:notification-service:template:${row.id}`);
      legacyTemplateIdToUuid.set(row.id, id);
      const { body, source } = readTemplateBodyHtml(row.machine_name);
      await prisma.notificationTemplate.upsert({
        where: { machineName: row.machine_name },
        create: {
          id,
          machineName: row.machine_name,
          title: row.title,
          visible: row.visible,
          help: row.help ?? '',
          settingsTitle: row.settings_title,
          bodyHtml: body,
        },
        update: {
          title: row.title,
          visible: row.visible,
          help: row.help ?? '',
          settingsTitle: row.settings_title,
          bodyHtml: body,
        },
      });
      if (source === 'missing') {
        log('template_body_missing_file', { machineName: row.machine_name });
      }
    }
    log('load_batch_complete', { step: 'notification_templates', rows: templateRows.rows.length });

    const allTemplateUuids = [...legacyTemplateIdToUuid.values()];
    if (allTemplateUuids.length) {
      log('load_batch_start', { step: 'template_groups_replace' });
      await prisma.templateGroup.deleteMany({
        where: { templateId: { in: allTemplateUuids } },
      });
      const tgData = m2mTemplateGroups.rows
        .map((r) => {
          const templateId = legacyTemplateIdToUuid.get(r.notificationtemplate_id);
          const groupId = legacyGroupIdToUuid.get(r.notificationgroup_id);
          if (!templateId || !groupId) {
            return null;
          }
          return { templateId, groupId };
        })
        .filter((x): x is { templateId: string; groupId: string } => x !== null);
      for (let i = 0; i < tgData.length; i += 500) {
        const chunk = tgData.slice(i, i + 500);
        if (chunk.length) {
          await prisma.templateGroup.createMany({ data: chunk, skipDuplicates: true });
        }
      }
      log('load_batch_complete', { step: 'template_groups_replace', rows: tgData.length });
    }

    const allGroupUuids = [...legacyGroupIdToUuid.values()];
    if (allGroupUuids.length) {
      log('load_batch_start', { step: 'group_managers_replace' });
      await prisma.notificationGroupManager.deleteMany({
        where: { groupId: { in: allGroupUuids } },
      });
      const gmData = m2mGroupManagers.rows
        .map((r) => {
          const groupId = legacyGroupIdToUuid.get(r.notificationgroup_id);
          if (!groupId) {
            return null;
          }
          return { groupId, managerUserId: String(r.user_id) };
        })
        .filter((x): x is { groupId: string; managerUserId: string } => x !== null);
      for (let i = 0; i < gmData.length; i += 500) {
        const chunk = gmData.slice(i, i + 500);
        if (chunk.length) {
          await prisma.notificationGroupManager.createMany({ data: chunk, skipDuplicates: true });
        }
      }
      log('load_batch_complete', { step: 'group_managers_replace', rows: gmData.length });
    }

    log('load_batch_start', { step: 'common_email_settings' });
    for (const row of ceRows.rows) {
      const userId = String(row.user_id);
      await prisma.commonEmailSettings.upsert({
        where: { userId },
        create: {
          userId,
          emailEnabled: row.email_enabled,
          doNotContact: Boolean(row.do_not_contact),
        },
        update: {
          emailEnabled: row.email_enabled,
          doNotContact: Boolean(row.do_not_contact),
        },
      });
    }
    log('load_batch_complete', { step: 'common_email_settings', rows: ceRows.rows.length });

    log('load_batch_start', { step: 'template_preferences' });
    for (const row of prefsToMigrate) {
      const templateId = legacyTemplateIdToUuid.get(row.notification_id);
      if (!templateId) {
        continue;
      }
      const userId = String(row.user_id);
      await prisma.templatePreference.upsert({
        where: { userId_templateId: { userId, templateId } },
        create: { userId, templateId, active: row.active },
        update: { active: row.active },
      });
    }
    log('load_batch_complete', { step: 'template_preferences', rows: prefsToMigrate.length });

    log('load_batch_start', { step: 'in_app_notifications' });
    for (const row of inAppRows.rows) {
      const id = uuidV5(`speakasap:notification-service:inapp:${row.id}`);
      await prisma.inAppNotification.upsert({
        where: { id },
        create: {
          id,
          userId: String(row.user_id),
          text: row.text,
          link: row.link,
          read: row.read,
          createdAt: row.created,
        },
        update: {
          text: row.text,
          link: row.link,
          read: row.read,
        },
      });
    }
    log('load_batch_complete', { step: 'in_app_notifications', rows: inAppRows.rows.length });

    log('load_batch_start', { step: 'letters' });
    for (const row of lettersToMigrate) {
      const templateId = legacyTemplateIdToUuid.get(row.template_id);
      if (!templateId) {
        continue;
      }
      const id = uuidV5(`speakasap:notification-service:letter:${row.id}`);
      const rendered = row.text ?? '';
      const recipients = splitRecipients(row.recipients);
      await prisma.letter.upsert({
        where: { id },
        create: {
          id,
          templateId,
          userId: String(row.user_id),
          renderedBody: rendered,
          renderedBodySha256: sha256Hex(rendered),
          recipients,
          fromEmail: row.from_email || null,
          sentAt: row.sent,
          createdAt: row.created,
        },
        update: {
          templateId,
          userId: String(row.user_id),
          renderedBody: rendered,
          renderedBodySha256: sha256Hex(rendered),
          recipients,
          fromEmail: row.from_email || null,
          sentAt: row.sent,
        },
      });
    }
    log('load_batch_complete', { step: 'letters', rows: lettersToMigrate.length });

    log('load_complete', {});
  } else {
    log('dry_run_no_writes', {});
  }

  await legacy.end();
  if (prisma) {
    await prisma.$disconnect();
  }

  if (writeDocs) {
    const docDir = join(SPEAKASAP_ROOT, 'docs', 'refactoring');
    const logPath = join(docDir, 'NOTIFICATION_DATA_MIGRATION_LOG.md');
    const block = `\n## Run ${ts()}\n\n\`\`\`json\n${JSON.stringify(
      {
        dryRun: !doLoad,
        counts,
        skipped: {
          lettersMissingTemplate: lettersSkipped.length,
          prefsMissingTemplate: prefsSkipped.length,
          missingTemplateFiles,
        },
      },
      null,
      2,
    )}\n\`\`\`\n`;
    appendFileSync(logPath, block);
    log('appended_migration_log', { path: logPath });
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ timestamp: ts(), msg: 'notification_etl_fatal', error: String(e) }));
  process.exit(1);
});
