---
partial: true
---
<section class="modules" markdown="1">

# Modules

<div class="grid">
  {{#each modules}}
  <a class="module" href="{{relative this.url}}">
    <div class="blur-cover">
      <img alt="{{this.title}}"
           src="{{relative this.cover}}">
    </div>
    <div class="year">{{floor this.year}}</div>
  </a>
  {{/each}}
</div>

</section>
