export interface ApiRequest {
  method?: string;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  query: Readonly<Record<string, string | string[] | undefined>>;
  body?: unknown;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string | readonly string[]): void;
  json(body: unknown): void;
  end(body?: string): void;
}

export type ApiHandler = (request: ApiRequest, response: ApiResponse) => void | Promise<void>;

export function header(request: ApiRequest, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, raw] of Object.entries(request.headers)) {
    if (key.toLowerCase() !== wanted) continue;
    return Array.isArray(raw) ? raw[0] : raw;
  }
  return undefined;
}

export function queryValue(request: ApiRequest, name: string): string | undefined {
  const raw = request.query[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

export function json(response: ApiResponse, status: number, body: unknown): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.status(status).json(body);
}

export function methodNotAllowed(response: ApiResponse, allow: readonly string[]): void {
  response.setHeader('Allow', allow.join(', '));
  json(response, 405, { error: 'Method not allowed' });
}
