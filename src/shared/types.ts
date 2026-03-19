export interface TabInfo {
  id: string;
  title: string;
  hasActivity: boolean;
  isActive: boolean;
}

export interface DevicePreset {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  category?: string;
}

export interface LogEntry {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info' | 'network-request' | 'network-response' | 'network-error';
  message: string;
  timestamp: number;
  stackTrace?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
}

export interface PortDetection {
  port: number;
  url: string;
  framework?: string;
}

export interface PromptDetection {
  tabId: string;
  options: string[];
  rawText: string;
}

export interface RouteDetection {
  route: string;
  filePath: string;
  framework: string;
}

export interface PreviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PreviewStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface MdFileInfo {
  path: string;
  name: string;
  relativePath: string;
}
