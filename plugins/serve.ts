import type * as Metalsmith from 'metalsmith';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';

interface Options {
  port?: number;
  debug?: boolean;
}

export function serve(opts: Options = {}): Metalsmith.Plugin {
  let running = false;
  let knownFiles = new Set<string>();

  return (files: Metalsmith.Files, ms: Metalsmith, done: Metalsmith.Callback) => {
    // Start a simple HTTP server
    knownFiles = new Set(Object.keys(files));
    if (running) return done(null, files, ms);
    running = true;
    const port = opts.port || 8000;
    const types: Record<string, string> = {
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      png: 'image/png',
      svg: 'image/svg+xml',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      ico: 'image/vnd.microsoft.icon',
      json: 'application/json',
      xml: 'application/xml',
    };
    const root = path.normalize(path.resolve(ms.directory(), ms.destination()));
    http.createServer((req, res) => {
      // TODO - use npm debug module
      if (opts.debug) console.log(`${req.method} ${req.url}`);
      let extension = path.extname(req.url!).slice(1);
      const type = extension ? types[extension] : types.html;
      const supportedExtension = Boolean(type);

      if (!supportedExtension) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('404: File not found');
        if (opts.debug) console.log(`404 bad extension: ${extension}`);
        return;
      }

      let fileName = req.url!;
      if (fileName.startsWith('/')) {
        if (fileName === '/') {
          fileName = 'index.html';
          extension = 'html';
        } else {
          fileName = fileName.substring(1);
        }
      }
      if (!extension) {
        try {
          fs.accessSync(path.join(root, fileName + '.html'), fs.constants.F_OK);
          fileName = fileName + '.html';
        } catch (e) {
          fileName = path.join(fileName, 'index.html');
        }
      }

      const filePath = path.join(root, fileName);
      if (opts.debug) console.log(`PATH: ${filePath}`);
      const isPathUnderRoot = path
          .normalize(path.resolve(filePath))
          .startsWith(root);

      if (!isPathUnderRoot || !knownFiles.has(fileName)) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('404: File not found');
        if (opts.debug) {
          if (!isPathUnderRoot) {
            console.log(`404 bad path: ${fileName} not under root`);
          } else {
            console.log(`404 bad path: ${fileName} not known: ${[...knownFiles].join(', ')}`);
          }
        }
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('404: File not found');
        if (opts.debug) console.log(`404 not found: ${filePath}`);
        } else {
          res.writeHead(200, { 'Content-Type': type });
          res.end(data);
        }
      });
    }).listen(port, () => {
      console.log(`Server is listening at http://localhost:${port}`);
    });
    return done(null, files, ms);
  };
}
