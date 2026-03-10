# Project Guidelines

## Stack
- **Backend**: NestJS (TypeScript) + Python FastAPI (AI layer)
- **Frontend Web**: React (TypeScript) + Vite
- **Frontend Mobile**: React Native (Android)
- **Database**: PostgreSQL + TypeORM
- **ASR**: 腾讯云语音识别（实时流式 + 录音文件识别）
- **AI Model**: Kimi-k2.5（Moonshot AI，OpenAI-compatible API）
- **Full reference**: See `AGENTS-GUIDE.md` for all 22 available agents.

---

## Commands

```bash
# Backend (NestJS)
npm run dev              # start dev server
npm run build            # compile TypeScript
npm run test             # jest unit tests
npm run test:e2e         # e2e tests
npm run test:cov         # coverage report
npm run lint             # eslint
npm run migration:run    # run TypeORM migrations
npm run migration:revert # rollback one migration

# Frontend Web (React + Vite)
npm run dev              # vite dev server
npm run build            # production build
npm run test             # vitest

# Frontend Mobile (React Native Android)
npx react-native run-android   # run on emulator/device
npx react-native start         # Metro bundler
npm run test                   # jest

# Python AI layer (FastAPI)
uvicorn main:app --reload      # dev server
pytest                         # run tests
pytest --cov                   # with coverage
mypy ai/                       # type check

# Docker
docker-compose up -d           # start all services
docker-compose down            # stop all
```

---

## Project Structure

```
project/
├── backend/src/
│   ├── modules/        # feature modules (one folder per domain)
│   ├── common/         # guards, filters, pipes, interceptors
│   ├── config/         # env config
│   └── migrations/     # TypeORM migrations (never edit manually)
├── frontend/src/        # React Web (Vite)
│   ├── components/     # atoms → molecules → organisms
│   ├── hooks/          # custom hooks (use*.ts)
│   ├── pages/          # route-level components
│   └── types/          # local types (import shared/ first)
├── mobile/              # React Native Android
│   ├── src/
│   │   ├── screens/    # screen-level components
│   │   ├── components/ # shared RN components
│   │   └── hooks/      # RN-specific hooks (audio recording etc.)
│   └── android/        # Android native config
├── ai/                  # Python FastAPI — AI layer
│   ├── services/
│   │   ├── asr.py      # 腾讯云 ASR 调用（实时 + 文件）
│   │   ├── llm.py      # Kimi-k2.5 调用（OpenAI-compatible）
│   │   └── outline.py  # 提纲生成逻辑
│   └── tests/
├── shared/types/        # TS types shared by backend + web + mobile
└── AGENTS-GUIDE.md
```

---

## Agent Orchestration

### Main Claude's Role
Main Claude = **orchestrator + decision maker**. NOT the implementer.

```
Main Claude responsibilities:
  ✅ Understand requirements, break into subtasks
  ✅ Decide which agents to call, in what order
  ✅ Pass context between agents
  ✅ Review agent outputs, resolve conflicts
  ✅ Make architectural decisions
  ❌ Do NOT write NestJS/React/Python/SQL code directly
  ❌ Do NOT run migrations or tests directly
  ❌ Do NOT implement what an agent can do better
```

### Agent Dispatch Table

| Task | Agent | Notes |
|------|-------|-------|
| NestJS module / API / Guard / DTO | `nestjs-expert` | Primary backend implementer |
| React component / Hook / state | `react-expert` | Primary frontend implementer |
| Python / AI service | `python-expert` | AI layer implementer |
| TypeScript types / generics / tRPC | `typescript-pro` | Always call BEFORE backend/frontend |
| PostgreSQL schema / SQL / EXPLAIN | `postgres-expert` | DB design & query analysis |
| TypeORM entity / migration / QueryBuilder | `typeorm-expert` | ORM layer, call AFTER postgres-expert |
| Write tests | `jest-expert` | Call AFTER implementation agents |
| Pre-commit review | `code-reviewer` | Call LAST before commit |
| Bug / error / test failure | `bug-fixer` | Call FIRST on any error |
| Security review | `security-auditor` | Required before any production deploy |
| Slow API / query / React perf | `performance-optimizer` | Only after profiling confirms bottleneck |
| Docker / CI/CD / GitHub Actions | `devops-engineer` | Infrastructure changes only |

### Calling Strategy: Parallel vs Sequential

**Run in PARALLEL** (independent, no data dependency):
```
typescript-pro + postgres-expert    → design types and schema simultaneously
nestjs-expert + react-expert        → implement backend and frontend simultaneously
jest-expert(backend) + jest-expert(frontend) → write tests for both layers
security-auditor + performance-optimizer    → pre-deploy checks
```

**Run SEQUENTIALLY** (each depends on previous output):
```
typescript-pro → nestjs-expert      (types must exist before API impl)
typescript-pro → react-expert       (types must exist before component impl)
postgres-expert → typeorm-expert    (schema design before ORM entities)
typeorm-expert → nestjs-expert      (entities before service/module)
[all impl agents] → jest-expert     (tests after implementation)
jest-expert → code-reviewer         (review after tests pass)
```

**Gate rules** — do NOT proceed until:
- `typescript-pro` output approved → before any implementation starts
- All tests passing → before `code-reviewer`
- `code-reviewer` approved → before commit
- `security-auditor` signed off → before production deploy

---

## Workflow by Scenario

### Full-Stack Feature (with DB change)
```
Phase 1 [PARALLEL]:
  typescript-pro → shared types
  postgres-expert → schema design + index strategy

Phase 2 [SEQUENTIAL, after Phase 1]:
  typeorm-expert → entity + migration (uses postgres-expert output)

Phase 3 [PARALLEL, after Phase 2]:
  nestjs-expert → API module
  react-expert  → UI components
  python-expert → AI logic (if feature needs AI)

Phase 4 [after Phase 3]:
  jest-expert → tests for all layers

Phase 5 [after tests pass]:
  code-reviewer → final review before commit
```

### Frontend-Only Change
```
PARALLEL: react-expert + typescript-pro (if new props needed)
THEN: jest-expert → code-reviewer
```

### Backend API Only (no DB change)
```
nestjs-expert → jest-expert → code-reviewer
```

### Database Schema Change Only
```
SEQUENTIAL: postgres-expert → typeorm-expert → nestjs-expert (update services)
THEN: jest-expert → code-reviewer
```

### Bug / Incident
```
1. bug-fixer FIRST — diagnose root cause (do not touch code yet)
2. bug-fixer proposes fix → main Claude reviews
3. Relevant impl agent applies fix (nestjs-expert / react-expert / etc.)
4. jest-expert → add regression test
5. code-reviewer → confirm fix is clean
```

### Pre-Deploy Checklist
```
PARALLEL:
  security-auditor → full security audit
  performance-optimizer → query + API perf check

SEQUENTIAL (after both pass):
  devops-engineer → migration order + rollback plan + CI/CD verify
```

### Context Handoff Between Agents
When passing output from one agent to the next, always include:
- The output artifact (types / schema / entity / API spec)
- Constraints the next agent must respect
- Any decisions made that affect their work

Example: "Here is the TypeScript interface from typescript-pro.
nestjs-expert: implement the `/outline` endpoint using this exact DTO type.
Do NOT change the field names."

---

## Coding Rules

**TypeScript**
- `strict: true` always. No bare `any`.
- No class components in React. Hooks only.
- File names: PascalCase for components, kebab-case for everything else.
- Import order: external → internal → types.

**NestJS**
- Controllers handle HTTP only. Business logic belongs in Services.
- All inputs validated via `ValidationPipe` + class-validator DTOs.
- `@UseGuards()` required on every non-public route.
- `synchronize: false` in TypeORM config — migrations only.

**React**
- Components stay under 200 lines. Split if larger.
- State: local → `useState/useReducer`, global → Zustand.
- All custom hooks prefixed with `use`.

**Python**
- Type hints on all public functions. Verified with `mypy --strict`.
- `black` for formatting. `pytest` for all tests.
- `async/await` first — no blocking I/O on the event loop.

**Database**
- Every migration has a working `down()` method.
- Never run migrations without reviewing the generated SQL first.
- Add indexes based on EXPLAIN ANALYZE evidence, not assumption.

---

## Safety Rules

🔴 **NEVER run without explicit user confirmation:**
- `DROP TABLE`, `TRUNCATE`, `DROP DATABASE`
- `DELETE` without `WHERE` clause
- Any TypeORM/migration command with `--force` or `synchronize: true` on prod
- `git push --force` to main

🟡 **Always check before running:**
- Database migrations on production data
- Bulk UPDATE statements
- File deletions

---

## Context Management

- At ~50% context: run `/compact` to summarize history.
- For complex tasks: start in plan mode, get approval, then implement.
- When stuck: stop and ask — don't loop on the same approach.
