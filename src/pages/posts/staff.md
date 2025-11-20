---
layout: default
title: Staff
permalink: /staff
---
<h1>Staff</h1>

<ul>
  {% for author in site.authors %}
    <li>
      <h2><a href="{{ author.url }}">{{ author.name }}</a></h2>
      <h3>{{ author.position }}</h3>
      <p>{{ author.content | markdownify }}</p>
    </li>
  {% endfor %}
</ul>

{% for staff_member in site.staff_members %}
  <h2>
    <a href="{{ staff_member.url }}">
      {{ staff_member.name }} - {{ staff_member.position }}
    </a>
  </h2>
  <p>{{ staff_member.content | markdownify }}</p>
{% endfor %}

        {% for essay in site.essays %}
        <h2>
          <a href="{{ essay.url }}">
            {{ essay.title }} - {{ essay.position }}
          </a>
        </h2>
        <p>{{ essay.content | markdownify }}</p>
      {% endfor %}