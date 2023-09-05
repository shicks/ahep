// Module preprocessor
// This plugin assembles the modules' contents and builds up the
// table of contents and carousel.

import type * as Metalsmith from 'metalsmith';
import * as path from 'path';
import { Module } from './module';

interface Metadata {
  modules: Record<string, Module>;
}

function cmp<T>(fn: (arg: T) => number|string): (a: T, b: T) => number {
  return (a, b) => {
    const fa = fn(a);
    const fb = fn(b);
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  };
}
function sortByYear(modules: Record<string, Module>): Record<string, Module> {
  const entries = Object.entries(modules);
  entries.sort(cmp(([, m]: [string, Module]) => m.year!));
  modules = {};
  for (const [k, v] of entries) {
    modules[k] = v;
  }
  return modules;
}

export function modules() {
  function plugin(files: Metalsmith.Files,
                  ms: Metalsmith,
                  done: Metalsmith.Callback) {

    const modules: Record<string, Module> = {};

    for (const [name, data] of Object.entries(files)) {
      const match = /modules\/(.*)\/index\.md/.exec(name);
      if (!match) continue;
      const slug = match[1];
      const module = new Module(slug, data);
      modules[slug] = module;
      data.module = module;
      data.contents = Buffer.from(module.content());
    }
    (ms.metadata() as Metadata).modules = sortByYear(modules);
    done(null, files, ms);
  }
  return plugin;
}
export default modules;
