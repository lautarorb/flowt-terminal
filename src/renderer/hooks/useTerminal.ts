import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface UseTerminalOptions {
  tabId: string;
  isActive: boolean;
  onData?: (tabId: string, data: string) => void;
}

export function useTerminal({ tabId, isActive, onData }: UseTerminalOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const mountedRef = useRef(false);

  const fit = useCallback(() => {
    if (!fitAddonRef.current || !containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;
    try {
      fitAddonRef.current.fit();
      const term = terminalRef.current;
      if (term) {
        window.vibeAPI.pty.resize(tabId, term.cols, term.rows);
      }
    } catch {
      // Ignore fit errors
    }
  }, [tabId]);

  useEffect(() => {
    if (!containerRef.current || mountedRef.current) return;

    const terminal = new Terminal({
      fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.8,
      cursorBlink: true,
      cursorStyle: 'bar',
      theme: {
        background: '#0A0A0A',
        foreground: '#FAFAFA',
        cursor: '#FAFAFA',
        selectionBackground: 'rgba(16, 185, 129, 0.3)',
        black: '#0A0A0A',
        red: '#EF4444',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#3B82F6',
        magenta: '#8B5CF6',
        cyan: '#06B6D4',
        white: '#FAFAFA',
        brightBlack: '#4B5563',
        brightRed: '#F87171',
        brightGreen: '#34D399',
        brightYellow: '#FBBF24',
        brightBlue: '#60A5FA',
        brightMagenta: '#A78BFA',
        brightCyan: '#22D3EE',
        brightWhite: '#FFFFFF',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon((_event, url) => {
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        window.vibeAPI.preview.navigate(url);
      } else {
        window.open(url, '_blank');
      }
    });

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(webLinksAddon);

    // Register custom link provider for bare localhost:PORT (without http://)
    const LOCALHOST_RE = /(localhost|127\.0\.0\.1):(\d{1,5})(\/[^\s"')\]}>.,;]*)?/;
    terminal.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
        if (!line) { callback(undefined); return; }
        const text = line.translateToString();
        const match = text.match(LOCALHOST_RE);
        if (match && match.index !== undefined) {
          const startCol = match.index;
          const linkText = match[0];
          callback([{
            range: { start: { x: startCol + 1, y: bufferLineNumber }, end: { x: startCol + linkText.length + 1, y: bufferLineNumber } },
            text: linkText,
            activate() {
              window.vibeAPI.preview.navigate('http://' + linkText);
            },
          }]);
        } else {
          callback(undefined);
        }
      },
    });

    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    mountedRef.current = true;

    // Create PTY
    window.vibeAPI.pty.create(tabId);

    // PTY data → terminal
    const cleanupData = window.vibeAPI.pty.onData((id, data) => {
      if (id === tabId) {
        terminal.write(data);
        onData?.(id, data);
      }
    });

    // Terminal input → PTY (only when in terminal mode — handled by InputBar)
    const disposeOnData = terminal.onData((data) => {
      window.vibeAPI.pty.write(tabId, data);
    });

    // Fit after a small delay to ensure container has dimensions
    requestAnimationFrame(() => fit());

    return () => {
      cleanupData();
      disposeOnData.dispose();
      terminal.dispose();
      mountedRef.current = false;
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [tabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refit on active tab change
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => fit());
    }
  }, [isActive, fit]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (isActive) {
        requestAnimationFrame(() => fit());
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [isActive, fit]);

  return {
    containerRef,
    terminal: terminalRef,
    focus: useCallback(() => terminalRef.current?.focus(), []),
    fit,
  };
}
