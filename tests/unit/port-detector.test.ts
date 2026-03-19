import { PortDetector } from '../../src/main/port-detector';
import { PortDetection } from '../../src/shared/types';

describe('PortDetector', () => {
  let detections: PortDetection[];
  let detector: PortDetector;

  beforeEach(() => {
    jest.useFakeTimers();
    detections = [];
    detector = new PortDetector((d) => detections.push(d));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function feedAndFlush(data: string) {
    detector.feed(data);
    jest.advanceTimersByTime(600);
  }

  it('detects Next.js dev server', () => {
    feedAndFlush('ready started server on 0.0.0.0:3000, url: http://localhost:3000');
    expect(detections).toHaveLength(1);
    expect(detections[0].port).toBe(3000);
    expect(detections[0].url).toBe('http://localhost:3000');
  });

  it('detects Vite dev server', () => {
    feedAndFlush('  VITE v5.0.0  ready in 200ms\n\n  ➜  Local:   http://localhost:5173/');
    expect(detections).toHaveLength(1);
    expect(detections[0].port).toBe(5173);
    expect(detections[0].framework).toBe('Vite');
  });

  it('detects Express server', () => {
    feedAndFlush('Server listening on port 4000');
    expect(detections).toHaveLength(1);
    expect(detections[0].port).toBe(4000);
  });

  it('detects generic localhost URL', () => {
    feedAndFlush('Visit http://localhost:8080 to see the app');
    expect(detections).toHaveLength(1);
    expect(detections[0].port).toBe(8080);
  });

  it('detects full localhost URL with path', () => {
    feedAndFlush('The page runs at: http://localhost:3000/onboarding/wizard');
    expect(detections).toHaveLength(1);
    expect(detections[0].port).toBe(3000);
    expect(detections[0].url).toBe('http://localhost:3000/onboarding/wizard');
  });

  it('handles split-chunk streaming', () => {
    detector.feed('http://local');
    jest.advanceTimersByTime(100);
    expect(detections).toHaveLength(0);

    feedAndFlush('host:3456/app');
    expect(detections).toHaveLength(1);
    expect(detections[0].port).toBe(3456);
  });

  it('debounces rapid detections', () => {
    detector.feed('http://localhost:3000');
    detector.feed(' and http://localhost:3001');
    jest.advanceTimersByTime(600);
    // Should only emit once (debounced to last)
    expect(detections.length).toBeLessThanOrEqual(1);
  });

  it('does not re-emit the same URL', () => {
    feedAndFlush('http://localhost:3000');
    expect(detections).toHaveLength(1);
    feedAndFlush('http://localhost:3000');
    expect(detections).toHaveLength(1);
  });

  it('trims buffer to MAX_BUFFER size', () => {
    const longData = 'x'.repeat(1000);
    detector.feed(longData);
    // Should not crash, buffer should be trimmed
    feedAndFlush('http://localhost:9999');
    expect(detections).toHaveLength(1);
  });

  it('does not false-positive on non-localhost URLs', () => {
    feedAndFlush('Visit https://example.com:3000 for docs');
    expect(detections).toHaveLength(0);
  });

  it('detects Nuxt dev server', () => {
    feedAndFlush('Nuxt ready on http://localhost:3000');
    expect(detections).toHaveLength(1);
    expect(detections[0].framework).toBe('Nuxt');
  });

  it('detects SvelteKit dev server', () => {
    feedAndFlush('SvelteKit v2.0.0 started at localhost:5173');
    expect(detections).toHaveLength(1);
  });
});
