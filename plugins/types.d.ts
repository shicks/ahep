declare module 'metalsmith-livereload' {
  import * as Metalsmith from 'metalsmith';
  interface Options {
    debug?: boolean;
  }
  function livereload(opts?: Options): Metalsmith.Plugin;
  export default livereload;
}

declare module 'metalsmith-markdownit' {
  import * as Metalsmith from 'metalsmith';
  interface Options {
    typographer?: boolean;
    html?: boolean;
  }
  interface Markdown {
    parser: {
      enable(features: string[]): void,
    }
    use(extension: unknown): void;
  }
  function markdown(preset: string, opts?: Options): Metalsmith.Plugin&Markdown;
  //function markdown(opts?: Options): Metalsmith.Plugin&Markdown;
  export default markdown;
}

declare module 'markdown-it-attrs' {
  import {PluginSimple} from 'markdown-it';
  const attrs: PluginSimple;
  export default attrs;
}
