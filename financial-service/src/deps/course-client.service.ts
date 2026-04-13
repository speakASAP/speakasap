import { Injectable, Logger } from '@nestjs/common';
import { getOutboundInternalToken } from './internal-api-token';
import { fetchJsonWithRetry } from './http-fetch';

export type ProductMetadataItem = {
  legacyProductId: number;
  legacyCategoryId: number;
  title: string;
  enTitle: string;
};

export type ProductsMetadataResponse = {
  items: ProductMetadataItem[];
  notFoundIds: number[];
};

@Injectable()
export class CourseClientService {
  private readonly logger = new Logger(CourseClientService.name);

  private baseUrl(): string {
    const u = process.env.COURSE_SERVICE_URL?.replace(/\/$/, '');
    if (!u) {
      throw new Error('COURSE_SERVICE_URL is not set');
    }
    return u;
  }

  private timeoutMs(): number {
    return Number(process.env.FINANCIAL_HTTP_TIMEOUT_MS || 8000);
  }

  async fetchProductsMetadata(ids: number[]): Promise<ProductsMetadataResponse> {
    const token = getOutboundInternalToken();
    if (!token) {
      throw new Error('Outbound internal token not configured');
    }
    const q = new URLSearchParams({ ids: ids.join(',') });
    const url = `${this.baseUrl()}/api/v1/internal/financial/products-metadata?${q.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await fetchJsonWithRetry<ProductsMetadataResponse>(
        'course.products-metadata',
        url,
        {
          method: 'GET',
          headers: { 'X-Internal-Token': token },
          signal: controller.signal,
        },
        this.logger,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
