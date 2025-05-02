declare module 'ali-oss' {
  export interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    secure?: boolean;
    internal?: boolean;
    endpoint?: string;
    cname?: boolean;
    timeout?: number;
  }

  export interface PutResult {
    name: string;
    url: string;
    res: {
      status: number;
      statusCode: number;
      headers: Record<string, any>;
    };
  }

  export interface GetResult {
    content: Buffer;
    res: {
      status: number;
      statusCode: number;
      headers: Record<string, any>;
    };
  }

  export interface SignatureUrlOptions {
    expires?: number;
    method?: string;
    content?: string | Buffer;
    contentType?: string;
    headers?: Record<string, string>;
    subResource?: string;
    process?: string;
    response?: Record<string, any>;
  }

  export default class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: any, options?: any): Promise<PutResult>;
    get(name: string, options?: any): Promise<GetResult>;
    delete(name: string, options?: any): Promise<any>;
    signatureUrl(name: string, options?: SignatureUrlOptions): string;
  }
} 