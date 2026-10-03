# Original (pre-React) implementation

These are the vanilla HTML/CSS/JS files this project was built from, kept for
reference and for comparing behaviour. They are **not** part of the React app
and are not built, served, or deployed.

| File           | What it was                                                      |
| -------------- | ---------------------------------------------------------------- |
| `index.html`   | SVG `feDisplacementMap` version, plus all of its inline JS        |
| `webgl.html`   | Three.js full-screen shader version                               |
| `old.html`     | Earlier prototype                                                 |
| `index.css`    | Demo chrome (control panel, bottom bar, background thumbnails)    |
| `bg-picker.js` | Background picker, built by direct DOM manipulation               |

## Note on asset paths

The background images used to live in `backgrounds/`. They now live in
`public/backgrounds/` because that is where Vite serves static files from, so
these legacy files would need their `backgrounds/` paths pointed at
`../public/backgrounds/` to run. To try one of them:

```
cd legacy
python -m http.server 8000
```

then open <http://127.0.0.1:8000/index.html>.

`old.html` also loads `/_vercel/insights/script.js`, which only resolves when
deployed to Vercel. It 404s locally; that is harmless.
