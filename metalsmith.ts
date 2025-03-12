#!/usr/bin/env -S npx -i bun

// TODO - node_modules/sucrease/bin/sucrase-node metalsmith.ts
// TODO - node_modules/esbuild-runner/bin/esr.js metalsmith.ts

/// <reference types="./plugins/types.d.ts" />

//import { fileURLToPath } from 'node:url';
//import { dirname } from 'node:path';
import Metalsmith from 'metalsmith';
import { fix } from './plugins/fix-metalsmith';
import { handlebars } from './plugins/handlebars';
import { log } from './plugins/log';
import { parseArgs } from 'node:util';
import { sass } from './plugins/sass-discover';
import { serve } from './plugins/serve';
import { timer } from './plugins/timer';
import collections from '@metalsmith/collections';
import linkChecker from './plugins/check-links';
import livereload from 'metalsmith-livereload';
import markdown from './plugins/markdown';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItDeflist from 'markdown-it-deflist';
import modules from './plugins/modules';

const [] = [log]; // okay to not use
fix();

const DIR = __dirname; // dirname(fileURLToPath(import.meta.url));
const {values: {
  'watch': shouldWatch,
  'check-links': shouldCheckLinks,
  'debug': debugArg,
}} = parseArgs({
  options: {
    'watch': {type: 'boolean'},
    'check-links': {type: 'boolean'},
    'debug': {type: 'boolean'},
  },
});

const DEBUG = !!process.env.DEBUG || debugArg;
if (!DEBUG) {
  console.log(`Detailed debugging disabled: rerun with --debug or export DEBUG=* for full stack`);
}
if (!shouldCheckLinks) {
  console.log(`Link checking disabled: rerun with --check-links for full report`);
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
    .use(linkChecker({
      ignore: [
        /^about$/,
        /^faq$/,
        /^modules$/,
        /1dq6aLBKWmz26_vbsFAZolNUzu0bRWw3WLhx9QhqqCgw/, // owned google doc
      ],
      allowRedirects: false,
      noHead: [
        /supercoloring\.com/,
        /grc\.nasa\.gov/,
      ],
      allow403: shouldCheckLinks ? [] : [
        /supercoloring\.com/,
        /zazzle\.com/,
        /etsy\.com/,
        /a-z-animals\.com/,
        /stlmotherhood\.com/,
        /coloring-page\.net/,
        // NOTE: the following seem to have banned me, but they were OK before
        // /sugarspaceandglitter\.com/,
        // /littlebinsforlittlehands\.com/,
      ],
      warnOnly: !shouldCheckLinks,
    }))
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
