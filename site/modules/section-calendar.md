---
partial: true
---
Below is one suggestion for your week with the book
_{{module.title}}_. Please experiment with what works for
your family! (Note: not all activities may be included in the
suggested sample week below).

<div class="calendar">
<div class="header">Monday</div>
<div class="header">Tuesday</div>
<div class="header">Wednesday</div>
<div class="header">Thursday</div>
<div class="header">Friday</div>
{{#each (range 3) as |row|}}
{{#each (keys ../module/calendar) as |day|}}
<div>{{{lookup (lookup ../../module/calendar day) row}}}</div>
{{/each}}
{{/each}}
</div>
