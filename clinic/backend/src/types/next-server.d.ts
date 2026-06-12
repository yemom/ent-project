declare module 'next/server' {
  export interface NextRequest {
    nextUrl: globalThis.URL & { pathname: string };
    url: string;
    cookies: {
      get(name: string): { value: string } | undefined;
    };
  }

  export class NextResponse {
    static next(): NextResponse;
    static redirect(url: globalThis.URL): NextResponse;
  }
}
