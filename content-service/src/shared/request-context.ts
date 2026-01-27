import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextData = {
  requestId: string;
  method: string;
  path: string;
  ip?: string;
  userId?: string;
};

export class RequestContext {
  private static readonly storage = new AsyncLocalStorage<RequestContextData>();

  static run(context: RequestContextData, callback: () => void): void {
    RequestContext.storage.run(context, callback);
  }

  static get(): RequestContextData | undefined {
    return RequestContext.storage.getStore();
  }
}
