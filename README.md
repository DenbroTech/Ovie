# Ovie

A household hub (calendar, tasks, shopping, TV tracking, meals and more) for a framed Raspberry Pi touchscreen and our phones.

- Product brief: [docs/BRIEF.md](docs/BRIEF.md)
- Agreed architecture decisions: [docs/KICKOFF.md](docs/KICKOFF.md). These win where the two disagree.
- How it's built: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Setup and deploy: [docs/SETUP.md](docs/SETUP.md)
- Backups: [docs/BACKUPS.md](docs/BACKUPS.md)

```
npm install
npm run dev          # needs .env.local (see .env.example)
npm test             # frontend tests
npm run test:db      # migrations + RLS tests on a throwaway local Postgres
npm run build
```
