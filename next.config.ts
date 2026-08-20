import originalExport from './next.config.original'
import type { NextConfig } from 'next'

let config: NextConfig;
if (typeof originalExport === 'function') {
  // Function-style config: (phase, context) => NextConfig
  // Wrap it to inject images config after resolution
  const origFn = originalExport as any;
  config = ((...args: any[]) => {
    const resolved = origFn(...args);
    if (resolved && typeof resolved.then === 'function') {
      return (resolved as Promise<NextConfig>).then((c: any) => {
        c.images = { ...c.images, loader: 'custom', loaderFile: './.edgeone/image-loader.mjs' };
        return c;
      });
    }
    (resolved as any).images = { ...(resolved as any).images, loader: 'custom', loaderFile: './.edgeone/image-loader.mjs' };
    return resolved;
  }) as any;
} else {
  config = { ...(originalExport as any) };
  config.images = { ...config.images, loader: 'custom', loaderFile: './.edgeone/image-loader.mjs' };
}

export default config;
