import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, createHash } from 'crypto';
import type { Response } from 'express';
import { createWriteStream } from 'fs';
import { readFile } from 'fs/promises';
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
  return [cleaned, 'courses/records/' + cleaned];
}

@Injectable()
export class LessonRecordStorageService {
  presignPut(key: string, contentType: string, expiresIn = 900): { url: string; expiresIn: number } {
    const config = this.s3Config();
    const signed = this.presignS3Url('PUT', key, expiresIn, {
      'content-type': contentType,
      host: config.host,
    });
    return { url: signed, expiresIn };
  }

  async headObject(key: string): Promise<{ etag: string; size: number }> {
    const res = await this.signedFetch('HEAD', key);
    if (!res.ok) {
      throw new BadRequestException('Object metadata check failed');
    }
    return {
      etag: (res.headers.get('etag') || '').replace(/\"/g, ''),
      size: Number(res.headers.get('content-length') || 0),
    };
  }


  async getObjectBuffer(recordKey: string): Promise<{ key: string; buffer: Buffer; size: number }> {
    for (const key of candidateKeys(recordKey)) {
      const res = await fetch(this.presignGet(key, 900));
      if (!res.ok) {
        if ([403, 404].includes(res.status)) {
          continue;
        }
        throw new ServiceUnavailableException('Private record S3 download failed');
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      return { key, buffer, size: buffer.length };
    }
    throw new NotFoundException('Lesson record object not found');
  }

  async putObject(key: string, body: Buffer, contentType = 'audio/mpeg'): Promise<{ size: number }> {
    const signed = this.presignPut(key, contentType, 900);
    const res = await fetch(signed.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException('Private record S3 upload failed');
    }
    return { size: body.length };
  }

  async deleteObjectCandidates(recordKey: string): Promise<{ attempted: string[]; deleted: string[]; failed: string[] }> {
    const attempted: string[] = [];
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const key of candidateKeys(recordKey)) {
      attempted.push(key);
      try {
        await this.deleteObject(key);
        deleted.push(key);
      } catch {
        failed.push(key);
      }
    }
    return { attempted, deleted, failed };
  }

  async downloadObjectToFile(recordKey: string, filePath: string): Promise<{ key: string; size: number }> {
    for (const key of candidateKeys(recordKey)) {
      const res = await fetch(this.presignGet(key, 900));
      if (!res.ok) {
        if ([403, 404].includes(res.status)) {
          continue;
        }
        throw new ServiceUnavailableException('Private record S3 download failed');
      }
      if (!res.body) {
        throw new ServiceUnavailableException('Private record S3 download returned no body');
      }
      let size = 0;
      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(filePath);
        Readable.fromWeb(res.body as never)
          .on('data', (chunk: Buffer) => {
            size += chunk.length;
          })
          .on('error', reject)
          .pipe(output)
          .on('error', reject)
          .on('finish', resolve);
      });
      return { key, size };
    }
    throw new NotFoundException('Lesson record object not found');
  }

  async putObjectFromFile(key: string, filePath: string, contentType = 'audio/mpeg'): Promise<{ size: number }> {
    const body = await readFile(filePath);
    const signed = this.presignPut(key, contentType, 900);
    const res = await fetch(signed.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException('Private record S3 upload failed');
    }
    return { size: body.length };
  }

  async deleteObject(key: string): Promise<boolean> {
    const res = await this.signedFetch('DELETE', key);
    if (res.ok || res.status === 404) {
      return true;
    }
    throw new ServiceUnavailableException('Private record S3 delete failed');
  }

  async streamRecord(recordKey: string, rangeHeader: string | undefined, res: Response): Promise<void> {
    const helperUrl = process.env.RECORDS_S3_HELPER_URL || '';
    const bucket = process.env.RECORDS_S3_BUCKET || '';
    if (!bucket) {
      throw new ServiceUnavailableException('Private record storage helper is not configured');
    }
    const isLegacyLocalHelper =
      !helperUrl ||
      helperUrl.includes('127.0.0.1') ||
      helperUrl.includes('localhost');
    for (const key of candidateKeys(recordKey)) {
      const fetchUrl = isLegacyLocalHelper
        ? this.presignGet(key, 900)
        : helperUrl.replace(/\/$/, '').replace(/\/upload$/, '') + '/download?' + new URLSearchParams({ bucket, key }).toString();
      const headers: Record<string, string> = {};
      if (rangeHeader) {
        headers.Range = rangeHeader;
      }
      const upstream = await fetch(fetchUrl, { headers });
      if (!upstream.ok) {
        if ([403, 404].includes(upstream.status)) {
          continue;
        }
        throw new ServiceUnavailableException(
          isLegacyLocalHelper ? 'Private record S3 stream failed' : 'Private record storage helper failed',
        );
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

  presignGet(key: string, expiresIn = 900): string {
    const config = this.s3Config();
    return this.presignS3Url('GET', key, expiresIn, {
      host: config.host,
    });
  }

  private async signedFetch(method: string, key: string): Promise<globalThis.Response> {
    const config = this.s3Config();
    const { url, headers } = this.signedS3Request(method, key, {
      host: config.host,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    });
    return fetch(url, { method, headers });
  }

  private s3Config(): {
    endpoint: URL;
    host: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    region: string;
  } {
    const endpoint = process.env.RECORDS_S3_ENDPOINT_URL || '';
    const bucket = process.env.RECORDS_S3_BUCKET || '';
    const accessKey = process.env.RECORDS_S3_ACCESS_KEY || '';
    const secretKey = process.env.RECORDS_S3_SECRET_KEY || '';
    const region = process.env.RECORDS_S3_REGION_NAME || 'eu-central-1';
    if (!endpoint || !bucket || !accessKey || !secretKey) {
      throw new ServiceUnavailableException('Private record S3 settings are not configured');
    }
    const url = new URL(endpoint.replace(/\/minio\/?$/, '').replace(/\/$/, ''));
    return { endpoint: url, host: url.host, bucket, accessKey, secretKey, region };
  }

  private objectUrl(key: string): URL {
    const config = this.s3Config();
    const encodedKey = cleanKey(key).split('/').map(encodeURIComponent).join('/');
    return new URL(config.endpoint.pathname.replace(/\/$/, '') + '/' + config.bucket + '/' + encodedKey, config.endpoint);
  }

  private presignS3Url(method: string, key: string, expiresIn: number, signedHeadersInput: Record<string, string>): string {
    const config = this.s3Config();
    const now = new Date();
    const amzDate = timestamp(now);
    const dateStamp = amzDate.slice(0, 8);
    const url = this.objectUrl(key);
    const credential = config.accessKey + '/' + dateStamp + '/' + config.region + '/s3/aws4_request';
    const signedHeaders = Object.keys(signedHeadersInput).map((h) => h.toLowerCase()).sort();
    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    url.searchParams.set('X-Amz-Credential', credential);
    url.searchParams.set('X-Amz-Date', amzDate);
    url.searchParams.set('X-Amz-Expires', String(Math.max(1, Math.min(900, expiresIn))));
    url.searchParams.set('X-Amz-SignedHeaders', signedHeaders.join(';'));
    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQuery(url.searchParams),
      canonicalHeaders(signedHeadersInput),
      signedHeaders.join(';'),
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      dateStamp + '/' + config.region + '/s3/aws4_request',
      sha256(canonicalRequest),
    ].join('\n');
    url.searchParams.set('X-Amz-Signature', hmacHex(signingKey(config.secretKey, dateStamp, config.region), stringToSign));
    return url.toString();
  }

  private signedS3Request(method: string, key: string, headersInput: Record<string, string>): {
    url: string;
    headers: Record<string, string>;
  } {
    const config = this.s3Config();
    const now = new Date();
    const amzDate = timestamp(now);
    const dateStamp = amzDate.slice(0, 8);
    const url = this.objectUrl(key);
    const headers: Record<string, string> = {
      ...headersInput,
      'x-amz-date': amzDate,
    };
    const signedHeaders = Object.keys(headers).map((h) => h.toLowerCase()).sort();
    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQuery(url.searchParams),
      canonicalHeaders(headers),
      signedHeaders.join(';'),
      headers['x-amz-content-sha256'] || 'UNSIGNED-PAYLOAD',
    ].join('\n');
    const scope = dateStamp + '/' + config.region + '/s3/aws4_request';
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
    const signature = hmacHex(signingKey(config.secretKey, dateStamp, config.region), stringToSign);
    headers.Authorization =
      'AWS4-HMAC-SHA256 Credential=' + config.accessKey + '/' + scope + ', SignedHeaders=' + signedHeaders.join(';') + ', Signature=' + signature;
    return { url: url.toString(), headers };
  }
}

function timestamp(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}

function signingKey(secret: string, dateStamp: string, region: string): Buffer {
  return hmac(hmac(hmac(hmac('AWS4' + secret, dateStamp), region), 's3'), 'aws4_request');
}

function canonicalHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => k + ':' + v + '\n')
    .join('');
}

function canonicalQuery(params: URLSearchParams): string {
  return Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
}
