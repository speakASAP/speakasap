#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { createHmac } = require('crypto');
const { existsSync, readFileSync, writeFileSync, readdirSync } = require('fs');
const { join } = require('path');
const { spawn } = require('child_process');

const ROOT = join(__dirname, '..');
const REPO_ROOT = join(ROOT, '..');
const MAX_DURATION_SECONDS = 6 * 60 * 60;
const DEFAULT_PROBE_LIMIT = 20;
const DEFAULT_BATCH_SIZE = 100;

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
    batchSize: DEFAULT_BATCH_SIZE,
    lessonUuid: '',
    lessonRecordUuid: '',
    periodFrom: '',
    periodTo: '',
    hostMinioBucketRoot: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) {
        throw new Error(`${arg} requires a value`);
      }
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
    else if (arg === '--batch-size') args.batchSize = Number(next());
    else if (arg === '--lesson-uuid') args.lessonUuid = next();
    else if (arg === '--lesson-record-uuid') args.lessonRecordUuid = next();
    else if (arg === '--period-from') args.periodFrom = next();
    else if (arg === '--period-to') args.periodTo = next();
    else if (arg === '--host-minio-bucket-root') args.hostMinioBucketRoot = next();
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.apply) {
    args.dryRun = true;
  }
  if (!Number.isInteger(args.limit) || args.limit < 0) {
    throw new Error('--limit must be a non-negative integer');
  }
  if (!Number.isInteger(args.probeLimit) || args.probeLimit < 0) {
    throw new Error('--probe-limit must be a non-negative integer');
  }
  if (!Number.isInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > 1000) {
    throw new Error('--batch-size must be an integer between 1 and 1000');
  }
  return args;
}

function printHelp() {
  console.log(`Lesson record duration backfill.

Dry-run sample:
  npm run backfill:lesson-record-durations -- --dry-run --probe-limit 20 --json-report /tmp/report.json

Apply:
  npm run backfill:lesson-record-durations -- --apply --confirm-write --approval-note "owner approval" --rollback-plan /tmp/rollback.sql --json-report /tmp/report.json

The script updates only education_lessonrecord.duration_seconds for ready lesson records with null duration_seconds.
Durations are derived from the private recording object with ffprobe, not from legacy payroll duration evidence.

Filters:
  --lesson-uuid <uuid>
  --lesson-record-uuid <uuid>
  --period-from YYYY-MM
  --period-to YYYY-MM
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

function localObjectPartPath(bucketRoot, key) {
  const objectDir = join(bucketRoot, cleanKey(key));
  if (!existsSync(join(objectDir, 'xl.meta'))) {
    return null;
  }
  for (const entry of readdirSync(objectDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const partPath = join(objectDir, entry.name, 'part.1');
    if (existsSync(partPath)) {
      return partPath;
    }
  }
  return null;
}

function probeFile(filePath) {
  return new Promise((resolve) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
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
        resolve({ ok: false, error: signal ? `ffprobe_${signal}` : `ffprobe_exit_${code}`, detail: sanitizeProbeDetail(stderr) });
        return;
      }
      const raw = stdout.trim().split(/\s+/)[0];
      const duration = Number(raw);
      if (!Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION_SECONDS) {
        resolve({ ok: false, error: 'invalid_duration' });
        return;
      }
      resolve({ ok: true, durationSeconds: Math.round(duration) });
    });
  });
}

async function probeRecord(recordKey, args) {
  const errors = [];
  for (const key of candidateKeys(recordKey)) {
    const result = args.hostMinioBucketRoot
      ? await probeLocalRecord(args.hostMinioBucketRoot, key)
      : await probeUrl(presignGet(key, 900));
    if (result.ok) {
      return { ok: true, key, durationSeconds: result.durationSeconds };
    }
    errors.push({ keyShape: key.startsWith('courses/records/') ? 'legacy_prefix' : 'canonical', error: result.error, detail: result.detail || null, httpStatus: result.httpStatus || null });
  }
  return { ok: false, error: errors[0]?.error || 'no_candidate_key', detail: errors[0]?.detail || null, httpStatus: errors[0]?.httpStatus || null };
}

async function probeLocalRecord(bucketRoot, key) {
  const partPath = localObjectPartPath(bucketRoot, key);
  if (!partPath) {
    return { ok: false, error: 'object_missing' };
  }
  return probeFile(partPath);
}

function periodStart(period) {
  if (!period) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error('period filters must be YYYY-MM');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

function nextPeriodStart(period) {
  const start = periodStart(period);
  if (!start) return null;
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

function candidateWhere(args) {
  const startGte = periodStart(args.periodFrom);
  const startLt = nextPeriodStart(args.periodTo);
  return {
    processed: true,
    recordKey: { not: null },
    durationSeconds: null,
    ...(args.lessonUuid ? { lessonUuid: args.lessonUuid } : {}),
    ...(args.lessonRecordUuid ? { uuid: args.lessonRecordUuid } : {}),
    ...((startGte || startLt) ? { lesson: { start: { ...(startGte ? { gte: startGte } : {}), ...(startLt ? { lt: startLt } : {}) } } } : {}),
  };
}

async function fetchCandidates(prisma, args, take) {
  return prisma.lessonRecord.findMany({
    where: candidateWhere(args),
    select: { uuid: true, lessonUuid: true, recordKey: true },
    orderBy: [{ createdAt: 'asc' }, { uuid: 'asc' }],
    ...(take > 0 ? { take } : {}),
  });
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
    domain: 'education_lesson_record_duration_backfill',
    generatedAt: new Date().toISOString(),
    writes: Boolean(args.apply),
    apply: args.apply,
    source: args.hostMinioBucketRoot ? 'host_minio_bucket_root_ffprobe' : 'private_lesson_record_media_ffprobe',
    counts: {},
    probed: { attempted: 0, succeeded: 0, failed: 0, samples: [], failures: [] },
    updated: 0,
    filters: {
      lessonUuid: args.lessonUuid || null,
      lessonRecordUuid: args.lessonRecordUuid || null,
      periodFrom: args.periodFrom || null,
      periodTo: args.periodTo || null,
    },
    approval: {
      requiredForApply: true,
      approvalNote: args.approvalNote || null,
      rollbackPlan: args.rollbackPlan || null,
    },
  };
  try {
    const candidateCount = await prisma.lessonRecord.count({
      where: candidateWhere(args),
    });
    const existingDurationCount = await prisma.lessonRecord.count({
      where: { durationSeconds: { not: null } },
    });
    report.counts.candidates = candidateCount;
    report.counts.existingDurationSeconds = existingDurationCount;
    const take = args.apply ? args.limit : Math.min(args.limit || args.probeLimit, candidateCount);
    const candidates = await fetchCandidates(prisma, args, take);
    report.counts.selected = candidates.length;
    const rollback = [];
    for (const record of candidates) {
      report.probed.attempted += 1;
      const probed = await probeRecord(record.recordKey, args);
      if (!probed.ok) {
        report.probed.failed += 1;
        if (report.probed.failures.length < 20) {
          report.probed.failures.push({ lessonRecordUuid: record.uuid, lessonUuid: record.lessonUuid, error: probed.error, detail: probed.detail || null, httpStatus: probed.httpStatus || null });
        }
        continue;
      }
      report.probed.succeeded += 1;
      if (report.probed.samples.length < 20) {
        report.probed.samples.push({
          lessonRecordUuid: record.uuid,
          lessonUuid: record.lessonUuid,
          durationSeconds: probed.durationSeconds,
          keyShape: probed.key.startsWith('courses/records/') ? 'legacy_prefix' : 'canonical',
        });
      }
      if (args.apply) {
        await prisma.lessonRecord.update({
          where: { uuid: record.uuid },
          data: { durationSeconds: probed.durationSeconds },
        });
        rollback.push(record.uuid);
        report.updated += 1;
      }
    }
    if (args.apply) {
      const rollbackSql = rollback.length
        ? `UPDATE "education_lessonrecord" SET "duration_seconds" = NULL WHERE "uuid" IN (${rollback.map(sqlString).join(', ')});\n`
        : '-- No lesson record duration rows were updated.\n';
      writeFileSync(args.rollbackPlan, rollbackSql);
    }
  } finally {
    await prisma.$disconnect();
  }
  const json = JSON.stringify(report, null, 2);
  if (args.jsonReport) {
    writeFileSync(args.jsonReport, json + '\n');
  }
  console.log(json);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
