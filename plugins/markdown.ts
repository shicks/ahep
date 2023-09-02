import {default as MarkdownIt, PluginSimple, PresetName} from 'markdown-it';
import type * as Metalsmith from 'metalsmith';

const PLUGIN_NAME = 'plugins/markdown';

interface Options {
  preset?: PresetName,
  options?: {
    typographer?: boolean,
    html?: boolean,
  },
  plugins?: PluginSimple[],
}

function escapeHandlebars(s: string): string {
  return escape(s).replace(/%/g, '\x01');
}
function unescapeHandlebars(s: string): string {
  return unescape(s.replace('\x01', '%'));
}

const HANDLEBARS_RE = /\x01|\{\{(\{[^{}]*\}|[^{}]*)\}\}?/g;

// We need to ensure markdown-it-attrs doesn't mess up our handlebars!
// To do that, we'll just escape all the {{ }} {{{ }}} we find.
export function markdown(opts?: Options) {
  return (files: Metalsmith.Files,
          ms: Metalsmith,
          done: Metalsmith.Callback) => {
    const {
      preset = 'default',
      options: mdOpts = {typographer: true, html: true},
      plugins = [],
    } = opts || {};
    const log = ms.debug(PLUGIN_NAME);
    const md = new MarkdownIt(preset, mdOpts);
    for (const plugin of plugins) {
      md.use(plugin);
    }
    for (const [name, file] of Object.entries(files)) {
      if (!name.endsWith('.md')) continue;
      const html = name.replace(/\.md$/, '.html');
      log.info(`Rendering markdown ${name}`);
      let contents = String(file.contents);
      contents = contents.replace(HANDLEBARS_RE, escapeHandlebars);
      try {
        contents = md.render(contents);
      } catch (err: unknown) {
        if (err instanceof Error) {
          err.message = `While markdown converting ${name}: ${err.message}`;
        } else {
          err = new Error(String(err));
        }
        return done(err as Error, files, ms);
      }
      contents = contents.replace(/\x01[0-9a-f]{2}/gi, unescapeHandlebars);
      file.contents = Buffer.from(contents);
      file.path = file.path.replace(/\.md$/, '.html');
      // TODO - do we need to markdown any of the attrs?
      // TODO - use renderInline if there's no \n\n anywhere???
      // TODO - consider a second markdown pass on <html markdown=1> elements?
      delete files[name];
      files[html] = file;
    }
    done(null, files, ms);
  };
}

export default markdown;
