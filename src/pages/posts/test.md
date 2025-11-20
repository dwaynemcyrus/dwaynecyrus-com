---
layout: default
title: test
id: home
backlinkExclude: true
---

NOTE: This is a new ==build== from me yay!

A test for linkTitles:
- The link should read "Jillian": [[Jill]]
- The link should read "Jilly Alias": [[jill|Jilly Alias]]
- The link shoud read the aliase over the link title: [[j.smith]]

[Markdown syntax](https://www.markdownguide.org/getting-started/) < This should open in new tab.

This should say [[invalid link]] when i check the code.

***

<h1>{{ "Hello Dwayne!" | downcase }}</h1>
    <p>front matter `my_number`: {{ page.my_number }}</p>

  

# Welcome! 🌱

<p style="padding: 3em 1em; background: #f5f7ff; border-radius: 4px;">
  Take a look at <span style="font-weight: bold">[[Your first note]]</span> to get started on your exploration.
</p>

This digital garden template is free, open-source, and [available on GitHub here](https://github.com/maximevaillancourt/digital-garden-jekyll-template).

The easiest way to get started is to read this [step-by-step guide explaining how to set this up from scratch](https://maximevaillancourt.com/blog/setting-up-your-own-digital-garden-with-jekyll).

<strong>Recently updated notes</strong>

<ul>
  {% assign recent_notes = site.notes | sort: "last_modified_at_timestamp" | reverse %}
  {% for note in recent_notes limit: 5 %}
    <li>
      <!-- {{ note.last_modified_at | date: "%Y-%m-%d" }} —  -->
      <a class="internal-link" href="{{ site.baseurl }}{{ note.url }}">{{ note.title }}</a>
    </li>
  {% endfor %}
</ul>

<style>
  .wrapper {
    max-width: 46em;
  }
</style>
