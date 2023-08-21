# Instructions

## WeasyPrint

* [Installation](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation)
    * Need to ensure we're using a consistent version of python as all the deps
    * Using venv

Note: WeasyPrint is not viable.  Instead, we'll use Chrome headless and
qpdf to underlay the background.  (There doesn't seem to be a decent way to
get a full bleed background with Chrome without also causing the inter-page
margins to disappear.

* `qpdf --underlay ahep-bg.pdf --repeat=1-z -- chrome.pdf final.pdf`

## Jekyll

* Installed via rbenv - had to make sure we were actually using a version
* Use `bundle exec jekyll serve`
* `bundle exec jekyll build --config _config.dev.yml`

## Sass

* `npx sass`
