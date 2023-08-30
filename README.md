# Instructions

## PDF generation

We looked into a handful of options (WeasyPrint, Prince, PanDoc, etc), but
ultimately printing via Chrome makes the most sense.  Unfortunately, I don't
know how to make Chrome underlay a full-bleed background while keeping the
inter-page margins, so instead we leave the background out and use [qpdf] to
underlay the background.

* `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless --disable-gpu --print-to-pdf=/tmp/out.pdf --no-margins --no-pdf-header-footer https://ahep1776.org/modules/freedom-on-the-menu/`
    * needs to print from a server in order to load web fonts, etc (but could be a local server)
    * try standard locations for Chrome on different OS'es
* `qpdf --underlay ahep-bg.pdf --repeat=1-z -- chrome.pdf final.pdf`

[qpdf]: https://qpdf.sourceforge.io/

## Jekyll

* Installed via rbenv - had to make sure we were actually using a version
* Use `bundle exec jekyll serve`
* `bundle exec jekyll build --config _config.dev.yml`

TODO - ruby is too finicky.  Let's look into gatsby.js.

## Sass

* `npx sass`

## Git

Use the [Desktop GitHub client](https://desktop.github.com) to manage the git.
Clone the repo to your local disk, then after making changes to modules, push
them to a branch to merge into `main`.  We will set up automatic deployment from
there.
