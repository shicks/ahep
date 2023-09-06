/// <reference types="./types.d.ts" />
import * as yamlJs from 'yaml-js';

// Schema
export class Schema<T> {
  constructor(readonly coerce: (obj: unknown) => T,
              readonly keys: string[] = [],
              readonly required: boolean = true) {}

  withKeys(...keys: string[]): Schema<T> {
    return new Schema(this.coerce, 
                      [...new Set([...this.keys, ...keys])],
                      this.required);
  }
  optional(): Schema<T|undefined>;
  optional<U>(defaultValue: U): Schema<T|U>;
  optional(defaultValue?: any): Schema<any> {
    return new Schema(
      (obj: unknown) => obj ? this.coerce(obj) : defaultValue,
      this.keys, false);
  }
  parse(str: string): T {
    return parse(str, this);
  }
}

function forName(name?: string): string {
  return name ? ` for ${name}` : '';
}

export function string(name?: string): Schema<string> {
  return new Schema((obj: unknown): string => {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number') return String(obj);
    if (Array.isArray(obj)) return `[${obj.map(string).join(', ')}]`;
    throw new Error(`Expected a string${forName(name)}, but found ${obj}`);
  });
}

export function sequence<T>(elem: Schema<T>, name?: string): Schema<T[]> {
  return new Schema((obj: unknown): T[] => {
    if (Array.isArray(obj)) return obj.map(e => elem.coerce(e));
    throw new Error(`Expected a sequence${forName(name)}, but found ${obj}`);
  });
}

export function struct<T extends Schemas>(schema: T, name?: string) {
  // analyze all the keys
  const keyMap = new Map<string, string>();
  for (const [k, s] of Object.entries(schema)) {
    for (let key of [k, ...((s as Schema<any>).keys || [])]) {
      key = canonicalizeKey(key);
      for (let i = 1; i <= key.length; i++) {
        const sub = key.substring(0, i);
        if (keyMap.has(sub) && keyMap.get(sub) !== k) {
          keyMap.set(sub, '');
        } else {
          keyMap.set(sub, k);
        }      
      }
    }
  }

  return new Schema((obj: unknown): Unschema<T> => {
    if (typeof obj !== 'object') {
      throw new Error(`Expected a mapping${forName(name)}, but found ${obj}`);
    } else if (!obj) {
      throw new Error(`Bad data${forName(name)}: ${obj}`);
    }
    const result: Unschema<T> = {} as Unschema<T>;
    for (const [k, v] of Object.entries(obj)) {
      const key = keyMap.get(canonicalizeKey(k)) as keyof T;
      if (!key) throw new Error(`Unexpected key ${k}${forName(name)}`);
      result[key] = schema[key].coerce(v);
    }
    for (const [k, s] of Object.entries(schema)) {
      if (k in result) continue;
      if (s.required) {
        throw new Error(`Missing required key ${k}${forName(name)}`);
      } else {
        result[k as keyof T] = s.coerce(undefined);
      }
    }
    return result as Unschema<T>;
  }); 
};

export function tuple<T extends unknown[]>(
    schema: SchemaTuple<T>, name?: string) {
  if (!Array.isArray(schema)) throw new Error();
  return new Schema((obj: unknown): T => {
    if (!Array.isArray(obj)) {
      throw new Error(`Expected a sequence${forName(name)}, but found ${obj}`);
    }
    if (obj.length !== schema.length) {
      throw new Error(`Expected ${schema.length} entries${
                       forName(name)}, but found ${obj.length}`);
    }
    const result: unknown[] = [];
    for (let i = 0; i < obj.length; i++) {
      result[i] = (schema[i] as Schema<unknown>).coerce(obj[i]);
    }
    return result as T;
  }); 
};

function canonicalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, '');
}

type Schemas = Record<string|number, Schema<any>>;
type Unschema<T extends Schemas> =
    {[K in keyof T]: T[K] extends Schema<infer U> ? U : never};
type SchemaTuple<T extends unknown[]> =
    T extends [] ? [] :
    T extends [infer H, ...infer R] ? [Schema<H>, ...SchemaTuple<R>] :
    [];
type YamlError = Error & {problem: string};

export function parse<T>(str: string, schema: Schema<T>): T {
  try {
    const obj = yamlJs.load(str);
    return schema.coerce(obj);
  } catch (err: unknown) {
    if (err instanceof Error && !err.message) {
      if ((err as YamlError).problem) {
        err.message = (err as YamlError).problem;
      }
      if (/mapping values are not allowed here/.test(err.message)) {
        err.message = `${err.message}. Did you forget to enclose a string in quotes that contained a colon?\n  `;
      }
    }
    throw err;
  }
}
