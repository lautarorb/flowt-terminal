declare module 'glob' {
  export function glob(pattern: string, options?: any): Promise<string[]>;
}

declare module 'fix-path' {
  function fixPath(): void;
  export default fixPath;
}
