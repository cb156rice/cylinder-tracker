# Cylinder Tracker

Reporting and tracking problems with Airgas gas cylinders for the Rice University stockroom.
Demo project, hosted entirely on GitHub.

- Live site: https://cb156rice.github.io/cylinder-tracker/
- Plan: [docs/ROADMAP.md](docs/ROADMAP.md)
- Picking this up in a new session: [docs/HANDOFF.md](docs/HANDOFF.md)

## Run it locally

```
npm install
npm run dev      # http://localhost:5173/cylinder-tracker/
npm test         # unit tests (Vitest)
npm run build    # production build into dist/
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Folders

| Path | What's in it |
|---|---|
| `src/` | The React app (form + admin dashboard) |
| `src/config.ts` | Public IDs (EmailJS, repo names). Never put secrets here. |
| `public/` | Static files served as-is (`privacy.html` is required by Google's sign-in screen) |
| `scripts/` | One-off helpers, such as `get-gmail-token.mjs` |
| `docs/` | Roadmap and session handoff |
| `design/` | Claude Design handoff. **Local only, not in git.** |
| `.github/workflows/` | Deploy to Pages |
