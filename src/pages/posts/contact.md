
Note: This is a site that will be customized for the use of [[Dwayne|Dwayne Michael Cyrus]], and we will be embracing [[anime stuff|anime]] to it's fullest.

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
      {{ note.last_modified_at | date: "%Y-%m-%d" }} — <a class="internal-link" href="{{ site.baseurl }}{{ note.url }}">{{ note.title }}</a>
    </li>
  {% endfor %}
</ul>

<strong> Recent Stuffs </strong>

<ul>
  {% assign recent_stuffs = site.stuffs | sort: "last_modified_at_timestamp" | reverse %}
  {% for stuff in recent_stuffs limit: 5 %}
    <li>
      {{ stuff.last_modified_at | date: "%Y-%m-%d" }} — <a class="internal-link" href="{{ site.baseurl }}{{ stuff.url }}">{{ stuff.title }}</a>
    </li>
  {% endfor %}
</ul>

<strong> Staff MEmbers  </strong>
{% for staff_member in site.staff_members %}
  <h2>Title: {{ staff_member.name }} - {{ staff_member.position }}</h2>
  <p>{{ staff_member.content | markdownify }}</p>
{% endfor %}

{% for staff_member in site.staff_members %}
  <h2> Link Title: 
    <a href="{{ staff_member.url }}">
      {{ staff_member.name }} - {{ staff_member.position }}
    </a>
  </h2>
  <p>{{ staff_member.content | markdownify }}</p>
{% endfor %}

<style>
  .wrapper {
    max-width: 46em;
  }
</style>