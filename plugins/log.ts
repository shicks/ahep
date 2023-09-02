import type * as Metalsmith from 'metalsmith';

export function log(name: string, ...paths: string[]) {
  return (files: Metalsmith.Files,
          ms: Metalsmith,
          done: Metalsmith.Callback) => {
      console.log(`\x1b[1;34m${name}\x1b[m`);
      for (const path of paths) {
        const file = files[path];
        console.log(`\x1b[1;34m${path}\x1b[m:\n${file?.contents}`);
      }
      done(null, files, ms);
    };
}
