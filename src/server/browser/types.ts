export type ManagedBrowserSession = {
  id: string;
  userId: number;
  username: string;
  sandboxDir: string;
  userDataDir: string;
  remoteDebuggingPort: number | null;
  cdpWsEndpoint: string | null;
  liveViewUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface BrowserSessionManager {
  start(userId: number, username: string): Promise<ManagedBrowserSession>;
  stop(userId: number): Promise<void>;
  currentUrl(userId: number): Promise<string | null>;
  capturePreview(userId: number): Promise<Buffer | null>;
  previewContentType(): string;
  chromeAvailable(): boolean;
}

export interface MockInstructionCapable {
  applyMockInstruction(userId: number, instruction: string): Promise<void>;
}

export type BrowserPageState = {
  url: string | null;
  title: string | null;
  textSnippet: string;
};

export interface BrowserAutomationCapable {
  navigate(userId: number, url: string): Promise<string | null>;
  getPageState(userId: number): Promise<BrowserPageState>;
  typeInto(userId: number, selector: string, text: string): Promise<string>;
  click(userId: number, selector: string): Promise<string>;
  waitForText(userId: number, text: string, timeoutMs?: number): Promise<boolean>;
}
