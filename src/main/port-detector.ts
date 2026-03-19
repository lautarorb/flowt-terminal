import { PortDetection } from '../shared/types';

interface FrameworkPattern {
  regex: RegExp;
  framework: string;
}

const FRAMEWORK_PATTERNS: FrameworkPattern[] = [
  // Specific frameworks first (before generic "ready on" pattern)
  { regex: /Nuxt\s+ready\s+on\s+https?:\/\/localhost:(\d+)/i, framework: 'Nuxt' },
  { regex: /SvelteKit\s+.*?localhost:(\d+)/i, framework: 'SvelteKit' },
  { regex: /remix.*?https?:\/\/localhost:(\d+)/i, framework: 'Remix' },
  { regex: /VITE\s+v[\d.]+\s+ready.*?localhost:(\d+)/i, framework: 'Vite' },
  { regex: /Local:\s+https?:\/\/localhost:(\d+)/i, framework: 'Vite' },
  { regex: /started\s+server\s+on\s+[\d.]+:(\d+)/i, framework: 'Next.js' },
  // Generic patterns last
  { regex: /ready\s+(?:on|at|started\s+(?:on|at))\s+https?:\/\/localhost:(\d+)/i, framework: 'Next.js' },
  { regex: /listening\s+(?:on|at)\s+(?:port\s+)?(\d+)/i, framework: 'Express' },
  { regex: /Server\s+running\s+(?:on|at)\s+https?:\/\/localhost:(\d+)/i, framework: 'Generic' },
];

// Captures full URL including path: http://localhost:3000/some/path
const GENERIC_LOCALHOST = /https?:\/\/localhost:(\d{3,5})(\/[^\s"')\]}>]*)?/g;

export class PortDetector {
  private buffer = '';
  private lastEmittedUrl = '';
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_BUFFER = 1000;

  constructor(private onDetected: (detection: PortDetection) => void) {}

  feed(data: string): void {
    this.buffer += data;
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer = this.buffer.slice(-this.MAX_BUFFER);
    }

    // Check framework-specific patterns first
    for (const pattern of FRAMEWORK_PATTERNS) {
      const match = this.buffer.match(pattern.regex);
      if (match) {
        const port = parseInt(match[1], 10);
        this.emit({ port, url: `http://localhost:${port}`, framework: pattern.framework });
        return;
      }
    }

    // Generic: capture any localhost URL with full path
    let lastMatch: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    GENERIC_LOCALHOST.lastIndex = 0;
    while ((m = GENERIC_LOCALHOST.exec(this.buffer)) !== null) {
      lastMatch = m;
    }
    if (lastMatch) {
      const port = parseInt(lastMatch[1], 10);
      const path = lastMatch[2] || '';
      const fullUrl = `http://localhost:${port}${path}`;
      this.emit({ port, url: fullUrl });
    }
  }

  private emit(detection: PortDetection): void {
    if (detection.url === this.lastEmittedUrl) return;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.lastEmittedUrl = detection.url;
      this.onDetected(detection);
      this.buffer = '';
    }, 500);
  }
}
