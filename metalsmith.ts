#!/usr/bin/env -S npx ts-node

// TODO - node_modules/sucrease/bin/sucrase-node metalsmith.ts
// TODO - node_modules/esbuild-runner/bin/esr.js metalsmith.ts

/// <reference types="./plugins/types.d.ts" />

//import { fileURLToPath } from 'node:url';
//import { dirname } from 'node:path';
import Metalsmith from 'metalsmith';
import { handlebars } from './plugins/handlebars';
import { fix } from './plugins/fix-metalsmith';
import { serve } from './plugins/serve';
import { timer } from './plugins/timer';
import { sass } from './plugins/sass-discover';
import { log } from './plugins/log';
import markdown from './plugins/markdown';
import modules from './plugins/modules';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItDeflist from 'markdown-it-deflist';
import collections from '@metalsmith/collections';
import livereload from 'metalsmith-livereload';

const [] = [log]; // okay to not use
fix();
 
const DIR = __dirname; // dirname(fileURLToPath(import.meta.url));
const shouldWatch = process.argv.includes('--watch');
const DEBUG = !!process.env.DEBUG || process.argv.includes('--debug');
if (!DEBUG) {
  console.log(`Detailed debugging disabled: rerun with --debug or export DEBUG=* for full stack`);
}

const t = timer();
const metalsmith = Metalsmith(DIR) // parent directory of this file
    .source('site')              // source directory
    .destination('build')       // destination directory
    .clean(true)                // clean destination before
    .env({                      // pass NODE_ENV & other environment variables
      DEBUG: process.env.DEBUG!,
      NODE_ENV: process.env.NODE_ENV!,
    })           
    .metadata({
      sitename: "American History Education Project",
      siteurl: "https://shicks.github.io/ahep/",
      description: "AHEP homepage",
    })
    .use(t)
    .use(collections({          // group all blog posts by internally
      modules: 'modules/*/index.md'  // adding key 'collections':'posts'
    }))                         // use `collections.posts` in layouts
    .use(modules())
    // can we mix markdown and html in handlebars?!?
    // i.e. layout: a.html
    //      file: foo.md
    //      -> content passes through md, then output is direct html?
    //      file: foo.md
    //        {{>block.html}}
    //        {{>other.md}}

    // NOTE: downside of markdown FIRST is that injecting a markdown
    //       snippet gets an extra nested <p>
    // We need to skip the outer paragraph for partials?

    .use(markdown({plugins: [markdownItAttrs, markdownItDeflist]}))
    .use(handlebars())          // BEFORE markdown!
    .use(sass())
    ;
if (shouldWatch) {
  metalsmith
      .use(livereload({debug: DEBUG}))
      .use(serve({debug: DEBUG}))
      .watch('site');
}

let ok = true;
metalsmith.build((err) => {           // build process
  const state = err ? '\x1b[1;31mFAILED\x1b[m' :
        ok ? 'succeeded' : '\x1b[1;32mSUCCEEDED\x1b[m';
  ok = !err;
  const time = t.elapsed();
  console.log(`Build ${state} in ${time}s`)
  if (err) {
    if (DEBUG) {
      console.error(err);
    } else {
      console.error('  ' + err.message.replace(/\n/g, '\n  '));
    }
  }
});
