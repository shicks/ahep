// NOTE: this code is forked from @fidian/metalsmith-broken-link-checker

// TODO - maybe what we want to do is to read a links.json file and produce
// a links.html report with the status of the links and controls to
//  * certify links are still valid (maybe open in iframes?)
//  * adjust the TTL for different kinds of links (seem good, manual 403s)
//  * download a new copy of links.json with adjusted data to overwrite

// TODO - save cache to disk, reuse w/in same day???
//      - maybe provide a different kind of check, e.g. for extra junk on links
//         - know how to prune amazon links?
//         - use various url shorteners?


import type * as Metalsmith from 'metalsmith';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import Debug from 'debug';
import * as async from 'async';
// @ts-ignore Bun is okay with this
import * as linkedom from 'linkedom';

//import userAgents from 'top-user-agents';

const debug = Debug('check-links');

/** A fake user agent. */
const userAgent: string = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
//userAgents[0];

/** A lenient WHATWG version of url.parse(). */
function urlParse(input: string): URL|undefined {
  try {
    return new URL(input);
  } catch (err) {
    return undefined;
  }
}

/** An object of a link in filename. */
interface FilenameAndLink {
  filename: string;
  checked: string; // when was it last checked, per some sort of metadata table?
  link: string;
}

/** An object of a link in a filename, with a validation result. */
interface FilenameAndLinkWithResult extends FilenameAndLink {
  result?: string;
}

interface Options {
  html: {
    /** Pattern to search for in html files. */
    pattern: string;
    /** Map of tags to attributes. */
    tags: Record<string, string|string[]>;
  };
  allow403: RegExp[];
  allowRedirects: boolean;
  attempts: number;
  userAgent: string;
  headers: Record<string, string>;
  noHead: RegExp[];
  timeout: number;
  ignore: RegExp[];
  parallelism: number;
  warnOnly: boolean;
}

interface FakeElement extends Element {
  attributes: NamedNodeMap & Attr[];
}
interface FakeDocument extends Document {
  querySelectorAll(query: string): FakeElement[] & NodeListOf<Element>;
}
interface FakeDom extends Window {
  document: FakeDocument;
}
interface MetalsmithDone {
  (err?: Error|string, files?: Metalsmith.Files, metalsmith?: Metalsmith): void;
}

/** Gather all links from all HTML files. */
function htmlLinks(
  metalsmith: Metalsmith,
  files: Metalsmith.Files,
  options: Options
): FilenameAndLink[] {
  // For each HTML file that matches the given pattern
  const htmlFiles = metalsmith.match(
    options.html.pattern,
    Object.keys(files)
  );
  return htmlFiles.reduce((arr: FilenameAndLink[], filename) => {
    debug(`Scanning file: ${filename}`);
    const file = files[filename];
    const dom: FakeDom = linkedom.parseHTML(file.contents.toString()) as any;
    
    const normalizedFilename = filename.replace(/[/\\]/g, "/");
    return arr.concat(
      // For each given tag
      ...Object.keys(options.html.tags).map((tag) => {
        let attributes = options.html.tags[tag];
        if (!Array.isArray(attributes)) {
          attributes = [attributes];
        }
        
        // For each given attribute, get the value of it
        return attributes.flatMap((attribute) =>
          dom.document
            .querySelectorAll(`${tag}[${attribute}][${attribute}!='']`)
            .map((elem) => elem.attributes.filter(
              (attr) => attr.name === attribute)[0].value))
          .map((link) => ({ filename: normalizedFilename, link }));
      })
    );
  }, []);
};

type Validator = (
  link: string,
  options: Options,
  asyncCallback: ValidatorCallback,
) => void;
type ValidatorCallback = (err: any, validationError?: string) => void;

/** Validate a FaceTime link. */
function validFacetime(link: string) {
  // https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/FacetimeLinks/FacetimeLinks.html
  if (link === "facetime:") {
    return null;
  }
  if (link.indexOf("@") === -1 && !link.match(/[0-9]/)) {
    return "invalid";
  }
  if (link.indexOf("@") >= 0) {
    if (!link.match(/^facetime:[^@]+@.+$/)) {
      return "invalid email address";
    }
  } else {
    if (link.indexOf(" ") !== -1) {
      return "contains a space";
    }
    if (!link.match(/^facetime:[0-9.+-]+$/)) {
      return "invalid phone number";
    }
  }
  return null;
}

const validUrlCache: Record<string, string|undefined> = {};

/** Validate a remote HTTP or HTTPS URL. */
function validUrl(
  link: string,
  options: Options,
  callback: ValidatorCallback,
  attempt = 1,
  method = "HEAD",
) {
  for (const re of options.noHead) {
    if (re.test(link)) {
      method = 'GET';
      break;
    }
  }
  const cacheAndCallback = (err: any, result: string|undefined) => {
    // Retry failures if we haven't reached the retry limit
    if (result && attempt <= options.attempts) {
      setTimeout(() => {
        validUrl(link, options, callback, attempt + 1, method);
      }, Math.min(1000, 100 * 2 ** attempt));
      return;
    }
    // Otherwise, store the result and call the callback
    validUrlCache[link] = result;
    callback(err, result);
  };
  if (link in validUrlCache) {
    callback(null, validUrlCache[link]);
    return;
  }

  // Link not in the cache - what to do?
  const library = link.slice(0, 5) === "https" ? https : http;
  const req = library.request(
    link,
    {
      method,
      headers: {
        // TODO: something to fix Pixabay
        "User-Agent": options.userAgent,
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'Keep-Alive',
        ...(options.headers || {}),
      },
      timeout: options.timeout,
      rejectUnauthorized: false
    },
    async (res) => {
      console.error(`URL: ${link}, status: ${res.statusCode}`);

      // Re-attempt HEAD 405s and 403s as GETs
      if ((res.statusCode === 405 || res.statusCode === 403) && method !== "GET") {
        validUrl(link, options, callback, attempt, "GET");
        return;
      }
      
      if (!res || !res.statusCode) {
        cacheAndCallback(null, "no response");
      } else if (res.statusCode >= 400 && res.statusCode <= 599) {
        if (res.statusCode === 403 && options.allow403.length) {
        
          // NOTE: allow403 could check the body, but let's not
          // const body = await new Promise<string>((resolve) => {
          //   let body = '';
          //   res.on('data', (chunk) => {
          //     body += chunk;
          //   });
          //   res.on('end', () => {
          //     resolve(body);
          //   });
          // });

          for (const re of options.allow403) {
            if (re.test(link /*body*/)) {
              cacheAndCallback(null, undefined);
              return;
            }
          }
        }
        cacheAndCallback(null, `HTTP ${res.statusCode}`);
      } else if (!options.allowRedirects && res.statusCode >= 300 && res.statusCode < 400) {
        cacheAndCallback(null, `HTTP ${res.statusCode}`);
      } else {
        cacheAndCallback(null, undefined);
      }
    }
  );

  req.on("error", (err) => {
    // Re-attempt HEAD errors as GETs
    if (method !== "GET") {
      validUrl(link, options, callback, attempt, "GET");
      return;
    }
    
    cacheAndCallback(null, err.message);
  });

  req.on("timeout", () => {
    req.destroy(); // cause an error
  });

  req.end();
};

/** Validate a mailto: link. */
function validMailto(link: string) {
  // https://www.w3docs.com/snippets/html/how-to-create-mailto-links.html
  if (!link.match(/^mailto:[^@]+/)) {
    return "invalid local-part";
  }
  if (!link.match(/^mailto:[^@]+@[^?]+/)) {
    return "invalid domain";
  }
  if (
    !link.match(
      /^mailto:[^@]+@[^?]+(\?(subject|cc|bcc|body)=[^&]+(&(subject|cc|bcc|body)=[^&]+)?)?$/
    )
  ) {
    return "invalid query params";
  }
  return null;
}

/** Validate a sms: link. */
function validSms(link: string) {
  // https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/SMSLinks/SMSLinks.html
  if (!link.replace(/ /g, "").match(/^sms:([0-9.+-]+)?$/)) {
    return "invalid";
  }
  if (link.indexOf(" ") !== -1) {
    return "contains a space";
  }
  return null;
}

/** Validate a tel: link. */
function validTel(link: string) {
  // https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html#//apple_ref/doc/uid/TP40007899-CH6-SW1
  if (!link.replace(/ /g, "").match(/^tel:([0-9.+-]+)?$/)) {
    return "invalid";
  }
  if (link.indexOf(" ") !== -1) {
    return "contains a space";
  }
  return null;
}

/** Return if a `dest` link from a `src` file is valid or not. */
function validLocal(files: Metalsmith.Files, src: string, dest: string): boolean {
  // TODO: anchor validation
  // Strip trailing anchor link
  dest = dest.replace(/#.*$/, "");

  // Strip trailing query string parameters
  dest = dest.replace(/\?.*$/, "");

  // Reference to self is always valid
  if (dest === "" || dest === "." || dest === "./") {
    return true;
  }

  // Resolve links and handle root-relative links
  const linkPath = dest.charAt(0) === '/' ? dest.substring(1) : path.join(path.dirname(src), dest);

  // Reference to self is always valid
  if (linkPath === "" || linkPath === "." || linkPath === "./") {
    return true;
  }

  if (linkPath in files) {
    return true;
  }

  const index = path.join(linkPath, "index.html");

  if (index in files) {
    return true;
  }

  return false;
}


const protocolValidators: Record<string, Validator> = {
  "facetime:": validFacetime,
  "facetime-audio:": validFacetime,
  "http:": validUrl,
  "https:": validUrl,
  "mailto:": validMailto,
  "sms:": validSms,
  "tel:": validTel
};

type DeepPartial<T> = T extends any[] ? T : T extends object ? {[K in keyof T]?: DeepPartial<T[K]>} : T;

/** Plugin entrypoint. */
export default (userOptions: DeepPartial<Options> = {}): Metalsmith.Plugin => {
  const options: Options = {
    html: {
      pattern: userOptions.html?.pattern ?? "**/*.html",
      tags: {
        a: "href",
        img: ["src", "data-src"],
        link: "href",
        script: "src",
        ...(userOptions.html?.tags || {}),
      },
    },
    allow403: userOptions.allow403 ?? [],
    allowRedirects: userOptions.allowRedirects ?? false,
    noHead: userOptions.noHead ?? [],
    headers: userOptions.headers as Record<string, string> ?? {},
    ignore: userOptions.ignore ?? [],
    timeout: userOptions.timeout ?? 5000, // 5 seconds
    attempts: userOptions.attempts ?? 3,
    userAgent: userOptions.userAgent ?? userAgent,
    parallelism: userOptions.parallelism ?? 100,
    warnOnly: userOptions.warnOnly ?? false,
  };

  const warned = new WeakMap<Metalsmith, Set<string>>();

  const plugin: Metalsmith.Plugin = ((files: Metalsmith.Files, metalsmith: Metalsmith, done: MetalsmithDone) => {
    const normalizedFilenames: Metalsmith.Files = {}
    for (const filename of Object.keys(files)) {
      normalizedFilenames[filename.replace(/[/\\]/g, "/")] = files[filename];
    }

    // Gather a list of filename + link combinations, and remove ignored links
    const duplicateDetection = new Set();
    let filenamesAndLinks = [
      ...htmlLinks(metalsmith, files, options)
      // TODO: CSS files
      // TODO: manifest files
    ];
    debug(`Detected ${filenamesAndLinks.length} links to check`);
    // Filter this out if this a duplicate of an item earlier in the array
    filenamesAndLinks = filenamesAndLinks.filter((v1) => {
      const stringVersion = JSON.stringify(v1);
      if (duplicateDetection.has(stringVersion)) {
        return false;
      }
      duplicateDetection.add(stringVersion);
      return true;
    });
    debug(`Eliminated duplicates, down to ${filenamesAndLinks.length} links to check`);
    // Filter this out if any ignore regex matches
    filenamesAndLinks = filenamesAndLinks.filter((filenameAndLink) => {
      const comparator = (re: RegExp) => re.test(filenameAndLink.link);
      return !(options.ignore as RegExp[]).some(comparator);
    });
    debug(`Eliminated ignored links, down to ${filenamesAndLinks.length} links to check`);
    // Shuffle to try to disperse checking the same domain concurrently
    filenamesAndLinks = filenamesAndLinks.sort(() => Math.random() - 0.5);

    // For each link, find the files it is broken for
    async.mapLimit(
      filenamesAndLinks,
      options.parallelism,
      (filenameAndLink: FilenameAndLink, callback: (err: any, result: FilenameAndLinkWithResult) => void) => {
        const callbackResult = (err: any, result: any) =>
          callback(err, { ...filenameAndLink, result });
        const { filename, link } = filenameAndLink;

        // Validate links with a protocol (remote links)
        const linkUrl = urlParse(link);
        if (linkUrl?.protocol) {
          if (protocolValidators[linkUrl.protocol] !== undefined) {
            const result = protocolValidators[linkUrl.protocol](
              link,
              options,
              callbackResult,
            );
            if (result === undefined) {
              // Validation function didn't return anything, it will call the callback for us
              return;
            }
            // Otherwise, call the callback with the validation result
            callbackResult(null, result);
            return;
          }

          // Assume all unknown protocols are valid
          callbackResult(null, null);
          return;
        }

        // Validate local files
        callbackResult(
          null,
          validLocal(normalizedFilenames, filename, link)
            ? null
            : "not found"
        );
      },
      (err: any, result?: (FilenameAndLinkWithResult|undefined)[]) => {
        if (err) {
          done(err);
          return;
        }

        const filenamesToLinkErrors: Record<string, string[]> = {};
        for (const filenameAndLink of result || []) {
          if (!filenameAndLink?.result) continue;
          if (!filenamesToLinkErrors[filenameAndLink.filename]) {
            filenamesToLinkErrors[filenameAndLink.filename] = [];
          }
          filenamesToLinkErrors[filenameAndLink.filename].push(
            `${filenameAndLink.link} (${filenameAndLink.result})`
          );
        }

        // Return a pretty formatted error if there are bad links
        if (Object.keys(filenamesToLinkErrors).length) {
          if (options.warnOnly) {
            const lastWarned = warned.get(metalsmith) || new Set();
            const thisWarned = new Set<string>();
            for (const [filename, errors] of Object.entries(filenamesToLinkErrors)) {
              const newErrors = errors.filter(err => {
                const key = filename + ' ' + err;
                thisWarned.add(key);
                return !lastWarned.has(key);
              });
              if (newErrors.length) {
                filenamesToLinkErrors[filename] = newErrors;
              } else {
                delete filenamesToLinkErrors[filename];
              }
            }
            warned.set(metalsmith, thisWarned);
          }

          const message = Object.keys(filenamesToLinkErrors)
            .sort()
            .map((filename) => {
              const output = filenamesToLinkErrors[filename]
                .sort()
                .map((linkError) => `  ${linkError}`)
                .join("\n");
              return `${filename}:\n${output}`;
            })
            .join("\n\n");

          if (options.warnOnly) {
            if (message) {
              console.log(`\n\x1b[1mWARNING: Broken links found:\n\n${message}\x1b[m\n`);
            }
          } else {
            done(`Broken links found:\n\n${message}`);
          }
        }

        done();
      }
    );
  }) as any;
  return plugin;
};
