# Instructions

## PDF generation

We looked into a handful of options (WeasyPrint, Prince, PanDoc, etc), but
ultimately printing via Chrome makes the most sense.  Unfortunately, I don't
know how to make Chrome underlay a full-bleed background while keeping the
inter-page margins, so instead we leave the background out and use [qpdf] to
underlay the background.

* `qpdf --underlay ahep-bg.pdf --repeat=1-z -- chrome.pdf final.pdf`

[qpdf]: https://qpdf.sourceforge.io/

## Jekyll

* Installed via rbenv - had to make sure we were actually using a version
* Use `bundle exec jekyll serve`
* `bundle exec jekyll build --config _config.dev.yml`

TODO - ruby is too finicky.  Let's look into gatsby.js.

## Sass

* `npx sass`
