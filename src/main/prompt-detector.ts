import { PromptDetection } from '../shared/types';

interface PromptPattern {
  regex: RegExp;
  extractor: (match: RegExpExecArray) => string[];
}

const PROMPT_PATTERNS: PromptPattern[] = [
  { regex: /\(([yY])\/([nN])\)/, extractor: (m) => [m[1].toUpperCase(), m[2].toUpperCase()] },
  { regex: /\[([yY])\/([nN])\]/, extractor: (m) => [m[1].toUpperCase(), m[2].toUpperCase()] },
  { regex: /\(yes\/no\)/i, extractor: () => ['yes', 'no'] },
  { regex: /\[yes\/no\]/i, extractor: () => ['yes', 'no'] },
  { regex: /Allow\?/i, extractor: () => ['Y', 'N'] },
  { regex: /Do you want to proceed\?/i, extractor: () => ['Y', 'N'] },
  { regex: /\(([1-9])(?:\/([1-9]))*\)/, extractor: (m) => {
    const full = m[0].replace(/[()]/g, '');
    return full.split('/');
  }},
  { regex: /(?:Select|Choose|Pick)\s.*?[:?]\s*$/im, extractor: () => ['1', '2', '3'] },
];

export class PromptDetector {
  private buffers = new Map<string, string>();
  private readonly MAX_BUFFER = 300;
  private lastDetection = new Map<string, number>();

  constructor(private onDetected: (detection: PromptDetection) => void) {}

  feed(tabId: string, data: string): void {
    let buffer = (this.buffers.get(tabId) || '') + data;
    if (buffer.length > this.MAX_BUFFER) {
      buffer = buffer.slice(-this.MAX_BUFFER);
    }
    this.buffers.set(tabId, buffer);

    // Debounce: don't re-detect within 2 seconds
    const lastTime = this.lastDetection.get(tabId) || 0;
    if (Date.now() - lastTime < 2000) return;

    for (const pattern of PROMPT_PATTERNS) {
      const match = buffer.match(pattern.regex);
      if (match) {
        this.lastDetection.set(tabId, Date.now());
        this.onDetected({
          tabId,
          options: pattern.extractor(match as RegExpExecArray),
          rawText: match[0],
        });
        this.buffers.set(tabId, '');
        return;
      }
    }
  }
}
