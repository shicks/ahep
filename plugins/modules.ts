// Module preprocessor
// This plugin assembles the modules' contents and builds up the
// table of contents and carousel.

import type * as Metalsmith from 'metalsmith';
import * as path from 'path';
import * as yaml from './yaml';

interface Metadata {
  modules: Record<string, Module>;
}

interface Module {
  slug?: string;
  year?: number;
  title?: string;
  cover?: string;
  module?: string;
  // TODO - gather activities from separate files?
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
      const title = data.title; // data.book.title;
      // TODO - extract from ## Book
      const year = data.when;
      const cover = `modules/${slug}/cover.jpg`;
      const module = `modules/${slug}`;
      const mod = {slug, title, year, cover, module};
      transform(data, mod);
      modules[slug] = mod;
    }
    (ms.metadata() as Metadata).modules = sortByYear(modules);
    done(null, files, ms);
  }
  return plugin;
}
export default modules;

function transform(data: Metalsmith.File, mod: Module) {
  // Separate the sections
  let contents = String(data.contents);
  try {
    const sections = contents.split(/^---\s*$/mg).map(makeSection);

    // look at sections, specifically book and calendar...

  } catch (err: unknown) {
    if (err instanceof Error) {
      err.message = `${err.message} in ${data.path}`;
    }
    throw err;
  }
}

// const SUBJECTS = [
//   'music',
//   'science',
//   'crafts',
//   'art',
//   'vocabulary',
//   'cooking',
//   're-enactment',
//   'bible',
//   'family',
//   'reading',
//   'biography',
// ] as const;
// type Subject = (typeof SUBJECTS)[number];

const sectionSchema: yaml.Schema<SectionMetadata> = yaml.struct({
  time: yaml.string('activity time'),
  preparation: yaml.string('preparation time').optional('minimal'),
  frequency: yaml.string('activity frequency').optional('once'),
  toc: yaml.string('activity toc name').optional(),
  supplies: yaml.string('activity supplies list').optional(),
  subject: yaml.string('activity subject').optional(),
}, 'activity metadata');

interface SectionMetadata {
  time: string;
  preparation: string;
  frequency: string;
  toc?: string;
  supplies?: string;
  subject?: string;
}

const bookSchema: yaml.Schema<BookMetadata> = yaml.struct({
  title: yaml.string('book title'),
  author: yaml.string('book author'),
  illustrator: yaml.string('book illustrator'),
  year: yaml.string('book publication year')
      .withKeys('year published', 'publication year'),
  length: yaml.string('book page length').withKeys('pages'),
}, 'book metadata');

interface BookMetadata {
  title: string;
  author: string;
  illustrator: string;
  year: string;
  length: string;
}
type SectionType = 'intro' | 'book' | 'calendar' | 'activity';
interface Section {
  body: string;
  type: SectionType;
  metadata?: SectionMetadata;
  book?: BookMetadata;
  calendar?: Calendar;
}

function calendarDaySchema(name: string) {
  return yaml.tuple<[string, string]>(
      [yaml.string(`day's first activity`),
       yaml.string(`day's second activity`)], name);
}
const calendarSchema: yaml.Schema<Calendar> = yaml.struct({
  monday: calendarDaySchema('Monday calendar'),
  tuesday: calendarDaySchema('Tuesday calendar'),
  wednesday: calendarDaySchema('Wednesday calendar'),
  thursday: calendarDaySchema('Thursday calendar'),
  friday: calendarDaySchema('Friday calendar'),
}, 'calendar');
interface Calendar {
  monday: [string, string];
  tuesday: [string, string];
  wednesday: [string, string];
  thursday: [string, string];
  friday: [string, string];
}

function makeSection(text: string) {
  if (!text) return; // TODO - make this an error
  let type: SectionType = 'activity';
  const sectionName = /^##\s*(.*?)(?:\s*\{.*?\})?$/m.exec(text)?.[1];
  if (!sectionName) throw new Error(`Could not find a ## header in ${text}`);

  if (sectionName === 'Introduction') {
    type = 'intro';
  } else if (sectionName === 'Book') {
    const bookMetadata = bookSchema.parse(text);
    // TODO - what to do with this?
  } else if (sectionName === 'Calendar') {
    const calendar = calendarSchema.parse(text);
    // TODO - do something
  } else if (text) {
    const match = /^```metadata\s*?\n((?:[^`].*\n)*)```$/m.exec(text);
    if (!match) {
      throw new Error(`No metadata block found in section ${sectionName}`);
    }
    try {
      const metadata = sectionSchema.parse(match[1]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        error.message = `${error.message} in section ${sectionName}`;
      }
      throw error;
    }
  }

}
