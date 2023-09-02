// A version of the Sass plugin that discovers the required files.

import { default as sassOriginal,
         Options as OriginalOptions } from '@metalsmith/sass';
import * as path from 'node:path';
import type { Options as SassOptions } from 'sass';
import type Metalsmith from 'metalsmith';

interface Options extends SassOptions<'sync'> {}

export function sass(opts: Options = {}): Metalsmith.Plugin {
  return (files: Metalsmith.Files, ms: Metalsmith, done: Metalsmith.Callback) => {
    const entries: Record<string, string> = {};
    for (const file of Object.keys(files)) {
      let index = file.lastIndexOf('.');
      if (index < 0) index = file.length;
      const root = file.substring(0, index);
      const ext = file.substring(index);
      if (ext === '.sass' || ext === '.scss') {
        const root = file.substring(0, file.length - 5);
        const sass = path.join(ms.source(), file);
        const css = root + '.css';
        entries[sass] = css;
      }
    }
    sassOriginal({...opts, entries} as OriginalOptions)(files, ms, done);
  }
}
