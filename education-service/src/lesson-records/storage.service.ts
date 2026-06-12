import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';

function cleanKey(key: string): string {
  return (key || '').trim().replace(/^\/+/, '').replace(/\/+$/g, '');
}

function candidateKeys(key: string): string[] {
  const cleaned = cleanKey(key);
  if (!cleaned) {
    return [];
  }
  if (cleaned.startsWith('courses/records/')) {
    return [cleaned, cleaned.slice('courses/records/'.length)];
  }
  return [cleaned, `courses/records/${cleaned}`];
}

@Injectable()
export class LessonRecordStorageService {
  async streamRecord(recordKey: string, rangeHeader: string | undefined, res: Response): Promise<void> {
    const helperUrl = process.env.RECORDS_S3_HELPER_URL || '';
    const bucket = process.env.RECORDS_S3_BUCKET || '';
    if (!helperUrl || !bucket) {
      throw new ServiceUnavailableException('Private record storage helper is not configured');
    }
    const helperBase = helperUrl.replace(/\/$/, '').replace(/\/upload$/, '');
    for (const key of candidateKeys(recordKey)) {
      const url = `${helperBase}/download?${new URLSearchParams({ bucket, key }).toString()}`;
      const headers: Record<string, string> = {};
      if (rangeHeader) {
        headers.Range = rangeHeader;
      }
      const upstream = await fetch(url, { headers });
      if (!upstream.ok) {
        if ([403, 404].includes(upstream.status)) {
          continue;
        }
        throw new ServiceUnavailableException('Private record storage helper failed');
      }
      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
      res.status(upstream.status === 206 ? 206 : 200);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      for (const header of ['content-length', 'content-range']) {
        const value = upstream.headers.get(header);
        if (value) {
          res.setHeader(header, value);
        }
      }
      if (!upstream.body) {
        res.end();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        Readable.fromWeb(upstream.body as never)
          .on('error', reject)
          .on('end', resolve)
          .pipe(res);
      });
      return;
    }
    throw new NotFoundException('Lesson record object not found');
  }
}
