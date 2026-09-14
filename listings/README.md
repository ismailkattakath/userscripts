# Listing copy

One file per script: the **Additional info** body of its Greasy Fork listing,
in Markdown, exactly as posted.

It lives here rather than only in the listing for three reasons:

- it is reviewable in a pull request, like the code it describes;
- a listing is edited by pasting into a form, and pasting from a versioned
  file beats pasting from memory;
- Greasy Fork's rules require a script to be *properly described*, so the
  description is part of the deliverable, not marketing around it.

Keep each file honest: what the script does, what it deliberately does **not**
do, how it differs from what is already on the shelf, and its known limits.
The ASCII diagrams are rendered with `mermaid-ascii -p 0 -x 1 -y 2` and pasted
inside a fenced block; Greasy Fork allows `<pre>`, so they survive.
