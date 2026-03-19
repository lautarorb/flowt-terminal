import { RouteTracker } from '../../src/main/route-tracker';
import { RouteDetection } from '../../src/shared/types';

describe('RouteTracker', () => {
  describe('mapFileToRoute', () => {
    let tracker: RouteTracker;

    beforeEach(() => {
      tracker = new RouteTracker(() => {});
    });

    // Next.js App Router
    it('maps Next.js app/page.tsx to /', () => {
      const result = tracker.mapFileToRoute('app/page.tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/');
    });

    it('maps Next.js app/about/page.tsx to /about', () => {
      const result = tracker.mapFileToRoute('app/about/page.tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/about');
    });

    it('maps Next.js dynamic route app/[id]/page.tsx to /:id', () => {
      const result = tracker.mapFileToRoute('app/[id]/page.tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/:id');
    });

    it('handles Next.js route groups app/(marketing)/about/page.tsx', () => {
      const result = tracker.mapFileToRoute('app/(marketing)/about/page.tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/about');
    });

    // Next.js Pages Router
    it('maps pages/index.tsx to /', () => {
      const result = tracker.mapFileToRoute('pages/index.tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/');
    });

    it('maps pages/users/[id].tsx to /users/:id', () => {
      const result = tracker.mapFileToRoute('pages/users/[id].tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/users/:id');
    });

    // Remix
    it('maps Remix routes/about.tsx to /about', () => {
      const result = tracker.mapFileToRoute('routes/about.tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/about');
    });

    it('maps Remix routes/users.$id.tsx to /users/:id', () => {
      const result = tracker.mapFileToRoute('routes/users.$id.tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/users/:id');
    });

    it('maps Remix routes/_index.tsx to /', () => {
      const result = tracker.mapFileToRoute('routes/_index.tsx');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/');
    });

    // Nuxt
    it('maps Nuxt pages/about.vue to /about', () => {
      const result = tracker.mapFileToRoute('pages/about.vue');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/about');
    });

    it('maps Nuxt pages/users/[id].vue to /users/:id', () => {
      const result = tracker.mapFileToRoute('pages/users/[id].vue');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/users/:id');
    });

    // SvelteKit
    it('maps SvelteKit routes/about/+page.svelte to /about', () => {
      const result = tracker.mapFileToRoute('routes/about/+page.svelte');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/about');
    });

    // Non-page files
    it('returns null for non-page files', () => {
      expect(tracker.mapFileToRoute('src/utils/helper.ts')).toBeNull();
      expect(tracker.mapFileToRoute('app/layout.tsx')).toBeNull();
      expect(tracker.mapFileToRoute('components/Button.tsx')).toBeNull();
    });
  });

  describe('feed', () => {
    it('detects route from editing pattern in PTY output', () => {
      const detections: RouteDetection[] = [];
      const tracker = new RouteTracker((d) => detections.push(d));

      tracker.feed('Editing file: app/about/page.tsx\n');
      expect(detections).toHaveLength(1);
      expect(detections[0].route).toBe('/about');
    });

    it('detects route from "Wrote" pattern', () => {
      const detections: RouteDetection[] = [];
      const tracker = new RouteTracker((d) => detections.push(d));

      tracker.feed('Wrote pages/index.tsx\n');
      expect(detections).toHaveLength(1);
      expect(detections[0].route).toBe('/');
    });

    it('ignores output without editing patterns', () => {
      const detections: RouteDetection[] = [];
      const tracker = new RouteTracker((d) => detections.push(d));

      tracker.feed('Running tests...\nAll passed!\n');
      expect(detections).toHaveLength(0);
    });
  });
});
