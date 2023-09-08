// Data types for a single AHEP module.

import type Metalsmith from 'metalsmith';
import * as yaml from './yaml';
import { augment } from './util';

const activityMetadataSchema: yaml.Schema<ActivityMetadata> = yaml.struct({
  time: yaml.string('activity time'),
  omit: yaml.boolean('omit').optional(false),
  preparation: yaml.string('preparation time').optional('minimal'),
  frequency: yaml.string('activity frequency').optional('once'),
  toc: yaml.string('activity toc name').optional(),
  supplies: yaml.string('activity supplies list').optional(),
  subject: yaml.string('activity subject').optional(),
}, 'activity metadata');

interface ActivityMetadata {
  time: string;
  preparation: string;
  frequency: string;
  toc?: string;
  supplies?: string;
  subject?: string;
  omit?: boolean;
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

const bookMetadataSchema: yaml.Schema<BookMetadata> = yaml.struct({
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

class ModuleSection {
  readonly heading: string;
  readonly id: string;
  constructor(readonly text: string) {
    // Look for the headings
    const headings =
        [...text.matchAll(/^##([^#].*)$/mg)].map(x => x[1].trim());
    if (headings.length > 1) {
      throw new Error(`Found multiple level-2 (##) headings in section: ${
          headings}`);
    } else if (!headings.length) {
      throw new Error(`No heading found in section starting "${
          text.substring(0, 100).replace(/\n/g, ' ')}"`);
    }
    // Trim out the ID
    const heading = headings[0];
    const match = /([^{]*)(?:\{.*?#([-_$a-z0-9]+)\})/.exec(heading);
    this.heading = (match?.[1] || heading).trim();
    this.id = match?.[2] || '';
  }
}

class Activity {
  readonly heading: string;
  toc: string;
  readonly id: string;
  readonly metadata: ActivityMetadata;
  readonly text: string;
  readonly searchKey: string;
  constructor(section: ModuleSection, readonly parent: Module) {
    try {
      this.heading = section.heading;
      this.text = section.text;
      this.id = section.id;
      const metadataBlock =
          /^```\s*metadata\n(.*?)\n```/ms.exec(this.text)?.[1];
      if (!metadataBlock) fail('No ```metadata block found');
      this.metadata = activityMetadataSchema.parse(metadataBlock);
      this.searchKey = `${caseInsensitive(this.id)} ${
                          caseInsensitive(this.heading)}`;
      this.toc = this.metadata.toc || this.heading;
    } catch (err: unknown) {
      this.rethrow(err);
    }
  }

  matches(key: string): boolean {
    return this.searchKey.includes(key);
  }

  markdown(markdown: (content: string, type: 'inline'|'block') => string) {
    this.toc = markdown(this.toc, 'inline');
  }
  
  tagActivity(err: unknown): Error {
    return augment(this.parent.tagModule(err), `under '## ${this.heading}'`,
                   taggedActivity, this);
  }
  rethrow(err: unknown): never {
    throw this.tagActivity(err);
  }
}

function calendarDaySchema(name: string) {
  return yaml.tuple<[string, string]>(
      [yaml.string(`first activity`),
       yaml.string(`second activity`)], name);
}
const calendarSchema: yaml.Schema<Calendar> = yaml.struct({
  monday: calendarDaySchema('Monday calendar'),
  tuesday: calendarDaySchema('Tuesday calendar'),
  wednesday: calendarDaySchema('Wednesday calendar'),
  thursday: calendarDaySchema('Thursday calendar'),
  friday: calendarDaySchema('Friday calendar'),
}, 'calendar');
interface Calendar {
  monday: [string, string, string?];
  tuesday: [string, string, string?];
  wednesday: [string, string, string?];
  thursday: [string, string, string?];
  friday: [string, string, string?];
}

const EXPECTED_HEADINGS = [
  ['Introduction', 'first'],
  ['Book', 'second'],
  ['Calendar', 'third'],
];

export class Module {
  name: string;
  title: string;
  year: string;
  cover: string;
  url: string;

  readonly sections: ModuleSection[];
  readonly intro: string;
  readonly book: BookMetadata;
  readonly calendar: Calendar;
  readonly activities = new Map<string, Activity>();
  readonly activitiesList: Activity[];

  constructor(readonly slug: string, readonly file: Metalsmith.File) {
    this.name = file.path;
    this.url = file.path.replace(/\.(md|html)$/, '');
    this.title = file.title;
    this.year = file.when;
    this.cover = `modules/${slug}/cover.jpg`;
    try {
      this.sections =
          String(file.contents).split(/^---\s*$/mg)
              .map(t => new ModuleSection(t));
      // validate
      EXPECTED_HEADINGS.forEach(([expected, pos], i) => {
        const found = this.sections[i]?.heading;
        if (!found) {
          fail(`Expected the ${pos} heading to be '## ${expected
                }' but did not find a ${pos} section`);
        } else if (expected !== found) {
          fail(`Expected the ${pos} heading to be '## ${expected
                }' but found '## ${found}' instead`);
        }
      });

      // collect static front sections
      const [intro, book, calendar, ...activities] = this.sections;
      this.intro = intro.text;
      this.book = this.parseBookMetadata(book.text);
      this.calendar = this.parseCalendar(calendar.text);

      // collect activities
      for (const section of activities) {
        if (this.activities.has(section.heading)) {
          fail(`Found duplicate heading: '## ${section.heading}'`);
        }
        const activity = new Activity(section, this);
        this.activities.set(section.heading, activity);
      }
      this.activitiesList =
          [...this.activities.values()].filter(a => !a.metadata.omit);
      this.fillCalendar();
    } catch (err: unknown) {
      this.rethrow(err);
    }
  }

  markdown(markdown: (content: string, type: 'inline'|'block') => string) {
    this.name = markdown(this.name, 'inline');
    this.title = markdown(this.title, 'inline');
    for (const activity of this.activitiesList) {
      activity.markdown(markdown);
    }
    for (const day of Object.values(this.calendar)) {
      for (let i = 0; i < day.length; i++) {
        day[i] = markdown(day[i], 'inline');
      }
    }
  }

  content(): string {
    return `${this.intro}

{{>modules/section-book}}

{{>modules/section-toc}}
{{>modules/section-calendar}}

---

${[...this.activitiesList].map(a => a.text).join('\n\n---\n\n')}`;
  }

  fillCalendar(): string {
    for (const activities of Object.values(this.calendar)) {
      // Look up the two activities
      const supplyLists = [];
      for (let i = 0; i < 2; i++) {
        let key = activities[i].trim();
        let text = '';
        const match = /^(.+?)\s*\[(.+)\]$/.exec(key);
        if (match) {
          text = match[1];
          key = match[2];
        }
        const activity = this.findActivity(key);
        if (!text) text = activity.toc;
        const supplies = activity.metadata.supplies;
        if (supplies) supplyLists.push(supplies);
        activities[i] = text;
      }
      const supplies = `**Supplies:**<br>${
        supplyLists.length ? supplyLists.join('<br><br>') : 'N/A'}`;
      activities[2] = supplies;
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    let out = `<table class="calendar"><th>`;
    for (const day of days) {
      out += `<td>${day}</td>`;
    }
    out += '</th><tr>';
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 4; i++) {
        const day = days[i].toLowerCase();
        out += this.calendar[day as keyof Calendar][j];
      }
      out += '</tr><tr>';
    }
    // TOOD - supplies
    out += '</tr></table>'
    return out;
  }

  parseBookMetadata(text: string): BookMetadata {
    // TODO - catch errors special for this?
    //   - bad-formed book metadata
    return bookMetadataSchema.parse(text);
  }
  parseCalendar(text: string): Calendar {
    // TODO - entire yaml pasted into real code eventually?
    return calendarSchema.parse(text);
  }

  // look for message and rethrow with module path embedded
  tagModule(err: unknown): Error {
    return augment(err, `in ${this.name}`, taggedModule, this);
  }
  rethrow(err: unknown): never {
    throw this.tagModule(err);
  }

  findActivity(key: string): Activity {
    // Given a key, look through all the activities for a unique substring match
    let found: Activity|undefined = undefined;
    for (const activity of this.activities.values()) {
      if (activity.matches(caseInsensitive(key))) {
        if (found) {
          fail(`Multiple activities matched '${key}': '## ${
                found.heading}' and '## ${activity.heading}'`);
        }
        found = activity;
      }
    }
    if (found) return found;
    fail(`No activity found matching '${key}': could not find '${
          caseInsensitive(key)}' in \n  ${[...this.activities.values()]
            .map(a => a.searchKey).join('\n  ')}`);
  }

}

function caseInsensitive(str: string): string {
  return str.toLowerCase().replace(/[^-_a-z0-9]/g, '');
}

const taggedModule: unique symbol = Symbol();
const taggedActivity: unique symbol = Symbol();
function assert(arg: unknown): asserts arg {
  if (!arg) throw new Error(`assertion failed`);
}
function fail(message: string): never {
  throw new Error(message);
}
