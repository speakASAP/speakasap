#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { createHmac } = require('crypto');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const { spawn } = require('child_process');

const ROOT = join(__dirname, '..');
const REPO_ROOT = join(ROOT, '..');
const DEFAULT_PROBE_LIMIT = 50;

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: false,
    confirmWrite: false,
    approvalNote: '',
    rollbackPlan: '',
    jsonReport: '',
    limit: 0,
    probeLimit: DEFAULT_PROBE_LIMIT,
    hostMinioBucketRoot: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[i];
    };
    if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--confirm-write') args.confirmWrite = true;
    else if (arg === '--approval-note') args.approvalNote = next();
    else if (arg === '--rollback-plan') args.rollbackPlan = next();
    else if (arg === '--json-report') args.jsonReport = next();
    else if (arg === '--limit') args.limit = Number(next());
    else if (arg === '--probe-limit') args.probeLimit = Number(next());
    else if (arg === '--host-minio-bucket-root') args.hostMinioBucketRoot = next();
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.apply) args.dryRun = true;
  if (!Number.isInteger(args.limit) || args.limit < 0) throw new Error('--limit must be a non-negative integer');
  if (!Number.isInteger(args.probeLimit) || args.probeLimit < 0) throw new Error('--probe-limit must be a non-negative integer');
  return args;
}

function printHelp() {
  console.log(`Lesson record key repair.

Dry-run:
  npm run repair:lesson-record-keys -- --dry-run --probe-limit 50 --json-report /tmp/report.json

Apply:
  npm run repair:lesson-record-keys -- --apply --confirm-write --approval-note "owner approval" --rollback-plan /tmp/rollback.sql --json-report /tmp/report.json

The script updates only education_lessonrecord.record from legacy/missing keys to canonical
YYYY/MM/DD/lesson_<lessonUuid>.mp3 when that canonical private object is reachable.

Optional remote-host optimization:
  --host-minio-bucket-root /srv/speakasap-records/speakasap-records`);
}

function loadEnvFrom(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function configureEnv(args = {}) {
  loadEnvFrom(join(REPO_ROOT, '.env'));
  process.env.DATABASE_URL = process.env.EDUCATION_TARGET_DATABASE_URL || process.env.EDUCATION_DATABASE_URL || process.env.DATABASE_URL;
  const required = args.hostMinioBucketRoot
    ? ['DATABASE_URL']
    : ['DATABASE_URL', 'RECORDS_S3_ENDPOINT_URL', 'RECORDS_S3_BUCKET', 'RECORDS_S3_ACCESS_KEY', 'RECORDS_S3_SECRET_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
}

function cleanKey(key) {
  return String(key || '').trim().replace(/^\/+/, '').replace(/\/+$/g, '');
}

function candidateKeys(key) {
  const cleaned = cleanKey(key);
  if (!cleaned) return [];
  if (cleaned.startsWith('courses/records/')) {
    return [cleaned, cleaned.slice('courses/records/'.length)];
  }
  return [cleaned, `courses/records/${cleaned}`];
}

function hmac(key, data, encoding) {
  return createHmac('sha256', key).update(data, 'utf8').digest(encoding);
}

function timestamp(now) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function presignGet(key, expiresIn = 900) {
  const endpoint = new URL(String(process.env.RECORDS_S3_ENDPOINT_URL || '').replace(/\/minio\/?$/, '').replace(/\/$/, ''));
  const bucket = process.env.RECORDS_S3_BUCKET;
  const accessKey = process.env.RECORDS_S3_ACCESS_KEY;
  const secretKey = process.env.RECORDS_S3_SECRET_KEY;
  const region = process.env.RECORDS_S3_REGION_NAME || 'eu-central-1';
  const now = new Date();
  const amzDate = timestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const encodedKey = cleanKey(key).split('/').map(encodeURIComponent).join('/');
  const url = new URL(`${endpoint.pathname.replace(/\/$/, '')}/${bucket}/${encodedKey}`, endpoint);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const signedHeaders = 'host';
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${accessKey}/${credentialScope}`);
  url.searchParams.set('X-Amz-Date', amzDate);
  url.searchParams.set('X-Amz-Expires', String(expiresIn));
  url.searchParams.set('X-Amz-SignedHeaders', signedHeaders);
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const canonicalRequest = ['GET', url.pathname, canonicalQuery, `host:${url.host}\n`, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    require('crypto').createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
  ].join('\n');
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign, 'hex');
  url.searchParams.set('X-Amz-Signature', signature);
  return url.toString();
}

async function probeUrl(url) {
  let status = 0;
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-1' } });
    status = res.status;
    if (!res.ok && res.status !== 206) {
      return { ok: false, error: `http_${res.status}` };
    }
  } catch (error) {
    return { ok: false, error: 'http_fetch_failed' };
  }
  return new Promise((resolve) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 30000);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          ok: false,
          error: signal ? `ffprobe_${signal}` : `ffprobe_exit_${code}`,
          detail: sanitizeProbeDetail(stderr),
          httpStatus: status,
        });
        return;
      }
      const raw = stdout.trim().split(/\s+/)[0];
      const duration = Number(raw);
      if (!Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION_SECONDS) {
        resolve({ ok: false, error: 'invalid_duration', httpStatus: status });
        return;
      }
      resolve({ ok: true, durationSeconds: Math.round(duration) });
    });
  });
}

function sanitizeProbeDetail(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}


async function objectReachable(key, args) {
  if (args.hostMinioBucketRoot) {
    return existsSync(join(args.hostMinioBucketRoot, cleanKey(key), 'xl.meta'));
  }
  const result = await probeUrl(presignGet(key, 900));
  return result.ok || result.error === 'invalid_duration' || result.error === 'ffprobe_exit_1';
}

function canonicalLessonKey(start, lessonUuid) {
  if (!start || !lessonUuid) return null;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = String(date.getUTCFullYear()).padStart(4, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}/lesson_${lessonUuid}.mp3`;
}

function cleanKey(key) {
  return String(key || '').trim().replace(/^\/+/, '').replace(/\/+$/g, '');
}

function needsRepair(recordKey, canonicalKey) {
  return Boolean(canonicalKey) && cleanKey(recordKey) !== canonicalKey;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  configureEnv(args);
  if (args.apply && (!args.confirmWrite || !args.approvalNote || !args.rollbackPlan)) {
    throw new Error('--apply requires --confirm-write, --approval-note, and --rollback-plan');
  }
  const prisma = new PrismaClient();
  const report = {
    domain: 'education_lesson_record_key_repair',
    generatedAt: new Date().toISOString(),
    writes: Boolean(args.apply),
    apply: args.apply,
    counts: {},
    probed: { attempted: 0, canonicalReachable: 0, currentReachable: 0, wouldUpdate: 0, updated: 0, samples: [], failures: [] },
    source: args.hostMinioBucketRoot ? 'host_minio_bucket_root_xl_meta' : 'private_s3_probe',
    approval: {
      requiredForApply: true,
      approvalNote: args.approvalNote || null,
      rollbackPlan: args.rollbackPlan || null,
    },
  };
  try {
    const where = {
      processed: true,
      recordKey: { not: null },
      lesson: { start: { not: null } },
    };
    report.counts.totalProcessedWithRecordAndStart = await prisma.lessonRecord.count({ where });
    const take = args.apply ? args.limit : Math.min(args.limit || args.probeLimit, report.counts.totalProcessedWithRecordAndStart);
    const rows = await prisma.lessonRecord.findMany({
      where,
      select: {
        uuid: true,
        lessonUuid: true,
        recordKey: true,
        lesson: { select: { start: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { uuid: 'asc' }],
      ...(take > 0 ? { take } : {}),
    });
    report.counts.selected = rows.length;
    const rollback = [];
    for (const row of rows) {
      const canonicalKey = canonicalLessonKey(row.lesson.start, row.lessonUuid);
      if (!needsRepair(row.recordKey, canonicalKey)) continue;
      report.probed.attempted += 1;
      const currentReachable = await objectReachable(row.recordKey, args);
      const canonicalReachable = await objectReachable(canonicalKey, args);
      if (currentReachable) report.probed.currentReachable += 1;
      if (canonicalReachable) report.probed.canonicalReachable += 1;
      if (!canonicalReachable) {
        if (report.probed.failures.length < 20) {
          report.probed.failures.push({ lessonRecordUuid: row.uuid, lessonUuid: row.lessonUuid, reason: 'canonical_object_missing' });
        }
        continue;
      }
      report.probed.wouldUpdate += 1;
      if (report.probed.samples.length < 20) {
        report.probed.samples.push({
          lessonRecordUuid: row.uuid,
          lessonUuid: row.lessonUuid,
          fromShape: cleanKey(row.recordKey).startsWith('courses/records/') ? 'old_prefix' : 'other',
          toShape: 'canonical',
        });
      }
      if (args.apply) {
        await prisma.lessonRecord.update({ where: { uuid: row.uuid }, data: { recordKey: canonicalKey } });
        rollback.push({ uuid: row.uuid, oldKey: row.recordKey });
        report.probed.updated += 1;
      }
    }
    if (args.apply) {
      const rollbackSql = rollback.length
        ? rollback.map((item) => `UPDATE "education_lessonrecord" SET "record" = ${sqlString(item.oldKey)} WHERE "uuid" = ${sqlString(item.uuid)};`).join('\n') + '\n'
        : '-- No lesson record keys were updated.\n';
      writeFileSync(args.rollbackPlan, rollbackSql);
    }
  } finally {
    await prisma.$disconnect();
  }
  const json = JSON.stringify(report, null, 2);
  if (args.jsonReport) writeFileSync(args.jsonReport, json + '\n');
  console.log(json);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
