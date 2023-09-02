---
partial: true
---
<section class="carousel" markdown="1">

# Great Picture Books

<div class="row">
  <a href="javascript:" class="left material-symbols-outlined">chevron_left</a>
  <a href="modules" class="carousel">
    {{#each modules}}
    <img src="{{this.cover}}">
    {{/each}}
  </a>
  <a href="javascript:" class="right material-symbols-outlined">chevron_right</a>
</div>

</section>
