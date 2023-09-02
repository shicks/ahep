import type * as Metalsmith from 'metalsmith';

interface Timer extends Metalsmith.Plugin {
  elapsed(): string;
}

export function timer(): Timer {
  let t!: number;
  const plugin = (files: Metalsmith.Files, ms: Metalsmith, done: Metalsmith.Callback) => {
    t = performance.now();
    done(null, files, ms);
  };
  plugin.elapsed = () => ((performance.now() - t) / 1000).toFixed(3);
  return plugin;
}
