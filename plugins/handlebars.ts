import * as Handlebars from 'handlebars';
import type * as Metalsmith from 'metalsmith';
import * as path from 'path';
import { augment } from './util';

interface Options {
  // Directory containing layouts (default: 'layouts')
  layouts?: string;
}

function update(file: Metalsmith.File, fn: (arg: string) => string) {
  file.contents = Buffer.from(fn(String(file.contents)));
}

const CONTENT_RE = /\{\{\{\s*content\s*\}\}\}/g;
const PARTIAL_BLOCK = '{{>@partial-block}}';
const PLUGIN_NAME = 'metalsmith-handlebars';

// Take a crack at doing our own plugin...
// Partials are tagged with a `partial: true` in the yaml
// A layout is just a partial in the `layouts/` directory, which uses
// `{{{contents}}}` somewhere in it.
export function handlebars(opts: Options = {}) {
  const layoutsDir = (opts.layouts || 'layouts') + '/';
  return (files: Metalsmith.Files,
          ms: Metalsmith,
          done: Metalsmith.Callback) => {
    const log = ms.debug(PLUGIN_NAME);
    const h = Handlebars.create();
    for (const [name, helper] of Object.entries(helpers)) {
      h.registerHelper(name, helper);
    }
    const requiredPartials = new Map();
    // First find all the partials and register/delete them.
    for (const [name, file] of Object.entries(files)) {
      if (!name.endsWith('.html')) continue;
      if (name.startsWith(layoutsDir)) {
        if (!CONTENT_RE.test(String(file.contents))) {
          return done(new Error(`No {{{content}}} in ${name}`), files, ms);
        }
        update(file, c => c.replace(CONTENT_RE, PARTIAL_BLOCK));
      }
      if (file.layout) {
        const layout = path.join(layoutsDir, file.layout);
        update(file, c => `{{#>${layout}}}${c}{{/${layout}}}`);
        requiredPartials.set(layout, name);
      }
      if (file.partial) {
        // Unwrap a single paragraph
        let contents = String(file.contents);
        const inner = /<p>(.*)<\/p>/.exec(contents)?.[1];
        if (inner && !/<p>/.test(inner)) contents = inner;
        // Register the patial
        const short = name.replace(/\.html$/, '');
        log.info(`Registering partial ${short} => ${file.contents}`);
        h.registerPartial(short, contents);
        delete files[name];
      }
    }

    for (const [partial, ref] of requiredPartials) {
      if (!h.partials[partial]) {
        // NOTE: we could make this slightly nicer by bundling all the errors
        return done(new Error(`Missing ${partial} used by ${ref}`), files, ms);
      }
    }
    // Then apply handlebars to everything else.
    for (const [name, file] of Object.entries(files)) {
      if (!name.endsWith('.html')) continue;
      log.info(`Rendering template for ${name} => ${file.contents}`);
      //for (const [k,v] of Object.entries(file)) {
      //  log.info(`  ${k}: ${v}`);
      //}
      try {
        // Markdown conversion screws this up...
        const contents = String(file.contents).replace(/&gt;/g, '>');
        file.contents = Buffer.from(h.compile(contents)({...ms.metadata(), ...file}));
      } catch (err: unknown) {
        if (err instanceof Error) {
          err.message = `While {{handlebars}} compiled ${name}: ${err.message}`;
        } else {
          err = new Error(String(err));
        }
        return done(err as Error, files, ms);
        
      }
    }
    done(null, files, ms);
  };
}

const helpers: Record<string, Handlebars.HelperDelegate> = {
  relative(file, options) {
    try {
      const result = path.relative(
          path.dirname(options.data.root.path), file) || '.';
      return result;
    } catch (err: unknown) {
      throw augment(err, `while expanding {{relative ${JSON.stringify(file)
                          }}} with root ${options.data?.root?.path}`);
    }
  }
}
