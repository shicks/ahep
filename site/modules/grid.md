---
partial: true
---
<section class="modules" markdown="1">

# Modules

<div class="grid">
  {{#each modules}}
  <a class="module" href="{{relative this.module}}/">
    <div class="blur-cover">
      <img alt="{{this.title}}"
           src="{{relative this.cover}}">
    </div>
    <div class="year">{{this.year}}</div>
  </a>
  {{/each}}
</div>

</section>