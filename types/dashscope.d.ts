declare module 'dashscope' {
  export function setApiKey(apiKey: string): void;
  
  export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }
  
  export interface ChatCompletionsOptions {
    model: string;
    messages: Message[];
    stream?: boolean;
    onMessage?: (message: { content: string }) => Promise<void>;
    onError?: (error: any) => Promise<void>;
    onEnd?: () => Promise<void>;
  }
  
  export interface ChatCompletionsResponse {
    ok: boolean;
    statusText?: string;
  }
  
  export function chatCompletions(options: ChatCompletionsOptions): Promise<ChatCompletionsResponse>;
} 