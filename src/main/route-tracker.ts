import * as path from 'path';
import * as fs from 'fs';
import { RouteDetection } from '../shared/types';

interface RouteMapping {
  framework: string;
  patterns: { regex: RegExp; routeExtractor: (match: RegExpExecArray) => string }[];
}

const ROUTE_MAPPINGS: RouteMapping[] = [
  {
    framework: 'nextjs-app',
    patterns: [
      {
        regex: /app\/(.+?)\/page\.(tsx?|jsx?)$/,
        routeExtractor: (m) => '/' + m[1].replace(/\(.*?\)\//g, '').replace(/\[(.+?)\]/g, ':$1'),
      },
      {
        regex: /app\/page\.(tsx?|jsx?)$/,
        routeExtractor: () => '/',
      },
    ],
  },
  {
    framework: 'nextjs-pages',
    patterns: [
      {
        regex: /pages\/(.+?)\.(tsx?|jsx?)$/,
        routeExtractor: (m) => {
          const route = m[1].replace(/\/?index$/, '').replace(/\[(.+?)\]/g, ':$1');
          return '/' + route;
        },
      },
    ],
  },
  {
    framework: 'remix',
    patterns: [
      {
        regex: /routes\/(.+?)\.(tsx?|jsx?)$/,
        routeExtractor: (m) => '/' + m[1].replace(/\./g, '/').replace(/\$(\w+)/g, ':$1').replace(/_index$/, ''),
      },
    ],
  },
  {
    framework: 'nuxt',
    patterns: [
      {
        regex: /pages\/(.+?)\.vue$/,
        routeExtractor: (m) => {
          const route = m[1].replace(/\/index$/, '').replace(/\[(.+?)\]/g, ':$1');
          return '/' + route;
        },
      },
    ],
  },
  {
    framework: 'sveltekit',
    patterns: [
      {
        regex: /routes\/(.+?)\/\+page\.svelte$/,
        routeExtractor: (m) => '/' + m[1].replace(/\(.*?\)\//g, '').replace(/\[(.+?)\]/g, ':$1'),
      },
    ],
  },
];

const EDITING_PATTERN = /(?:Editing|Writing|Wrote|Modified)\s+(?:file:?\s*)?[`"']?([^\s`"']+)[`"']?/i;

export class RouteTracker {
  private cwd = process.env.HOME || '/';
  private detectedFramework: string | null = null;
  private buffer = '';
  private readonly MAX_BUFFER = 1000;

  constructor(private onDetected: (detection: RouteDetection) => void) {}

  setCwd(cwd: string): void {
    this.cwd = cwd;
    this.detectFramework();
  }

  feed(data: string): void {
    this.buffer += data;
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer = this.buffer.slice(-this.MAX_BUFFER);
    }

    const match = this.buffer.match(EDITING_PATTERN);
    if (match) {
      const filePath = match[1];
      const route = this.mapFileToRoute(filePath);
      if (route) {
        this.onDetected(route);
      }
      this.buffer = '';
    }
  }

  private detectFramework(): void {
    try {
      const pkgPath = path.join(this.cwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['next']) this.detectedFramework = 'nextjs';
        else if (deps['@remix-run/react']) this.detectedFramework = 'remix';
        else if (deps['nuxt']) this.detectedFramework = 'nuxt';
        else if (deps['@sveltejs/kit']) this.detectedFramework = 'sveltekit';
        else if (deps['vite']) this.detectedFramework = 'vite';
      }
    } catch {
      // Ignore
    }
  }

  mapFileToRoute(filePath: string): RouteDetection | null {
    const relativePath = filePath.startsWith('/') ? path.relative(this.cwd, filePath) : filePath;

    for (const mapping of ROUTE_MAPPINGS) {
      for (const pattern of mapping.patterns) {
        const match = relativePath.match(pattern.regex);
        if (match) {
          return {
            route: pattern.routeExtractor(match as RegExpExecArray),
            filePath: relativePath,
            framework: mapping.framework,
          };
        }
      }
    }
    return null;
  }
}
