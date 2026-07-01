# Production Readiness Audit — hiai-docs

> **Аудит проведён:** HEAD `14b3fd9` (branch `main`), после тега `v0.1.0` (`ef831bf`).
> **Метод:** статический анализ репозитория + прогон `bun run typecheck` / `bun run lint`. Тесты не запускались намеренно: поднят живой **dev**-стек с БД на `:5437`, а `bun test` пишет в БД (CI использует отдельную `hiai_docs_test`).
> **Ничего в репозитории не менялось** — только анализ.

## Вердикт

**К продакшену «из коробки» НЕ готов.** Кодовая база качественная (typecheck чистый, версии синхронны, Docker-образы многоступенчатые с non-root пользователем), но **слой развёртывания/конфигурации содержит блокирующие дефекты**. Документ `docs/PRODUCTION_STATUS.md` заявляет `✅ READY FOR DEPLOYMENT`, однако он устарел, а рекомендуемый путь `cp .env.example .env && docker compose up -d` небезопасен.

Ниже — по убыванию серьёзности, со ссылками `файл:строка`.

---

## 🔴 Блокирующие (нельзя пускать в прод как есть)

### 1. Продакшен- compose запускает приложение в режиме разработки
`docker-compose.yml:147` — `NODE_ENV: development` в «боевом» файле.

Следствия:
- обходится единственный прод-гард в схеме конфига: `backend/src/lib/config-schema.ts:25-30` проверяет `BETTER_AUTH_SECRET != default` **только** при `NODE_ENV=production`. В `development` приложение молча стартует с дефолтным/слабым секретом.
- включаются dev-пути кода, verbose-логирование, отключаются прод-оптимизации.

При этом `Dockerfile.backend:52` корректно ставит `NODE_ENV=production` — compose его перетирает.

### 2. Продакшен- compose НЕ пробрасывает `CSRF_SECRET` и `WEBHOOK_SECRET`
В блоке `environment` сервиса `api` (`docker-compose.yml:106-148`) этих переменных нет. В `backend/src/lib/config-schema.ts:32,34` у них **нет** прод-гарда (в отличие от `BETTER_AUTH_SECRET`) — они молча дефолтятся до `"change-me-to-random-32-chars"` **в любой среде, включая production**. Боевая инсталляция будет подписывать CSRF-токены и вебхуки публично известным дефолтом.

При этом `docs/DEPLOYMENT.md:59-60` помечает их как `Required`. CI это не ловит — в `.github/workflows/ci.yml` проверяется только `docker compose config --quiet` (синтаксис), а не запуск стека.

### 3. В публичном `.env.example` лежат реальные секреты
`.env.example` отслеживается git. В нём:
- `BETTER_AUTH_SECRET` = 64-символьный hex (`.env.example:18`) — не плейсхолдер, это ровно то, что выдаёт `openssl rand -hex 32`;
- `HIAI_DOCS_API_KEY` = 64-символьный hex (`.env.example:77`);
- `OWNER_ID` = реальный UUID (`.env.example:80`).

Для контраста `MINIO_SECRET_KEY=changeme` (8 символов) — нормальный плейсхолдер. Заголовок файла пишет «edit the values marked with CHANGE», но ни одно значение не помечено `CHANGE`. Это нарушает собственный `RELEASE_CHECKLIST.md:8-11` («Regenerate secrets»). Репо публичное (MIT). Если эти значения совпадают с боевым `.env` — это утечка; даже если нет — публикация сгенерированных секретов в шаблоне провоцирует оставить «как есть».

### 4. Продакшен- Caddy не запустится из-за `rate_limit`
`Caddyfile:30` использует директиву `rate_limit`, которой **нет** в штатном образе `caddy:2-alpine` (это сторонний модуль `caddy-ratelimit`, нужен кастом-сбор через xcaddy). В compose используется штатный образ (`docker-compose.yml:187`) без кастом-билда — Caddy упадёт с `unknown directive: rate_limit`.

CI это не отлавливает: Caddy под профилем `caddy` не стартует, Caddyfile не валидируется. Примечательно, что `.bob/plans/open-source-release-v1.md:35` сам отметил «HIGH — No rate_limit» — проблему «починили», вставив директиву в образ, который её не поддерживает. Рекомендую проверить: `caddy validate --config Caddyfile --adapter caddyfile`.

### 5. Нельзя воспроизвести сборку: `bun.lock` в `.gitignore`, а зависимости — сплошь `"latest"`
`.gitignore:3` — `bun.lock` (подтверждено: `git ls-files bun.lock` пуст). При этом `"latest"` стоит у **~80 зависимостей**: `backend/package.json` — 22, `frontend/package.json` — 49, `packages/db/package.json` — 6, корневой `package.json` — 3 (elysia, better-auth, drizzle-orm, zod, vite, svelte и т.д.). Любой `bun install` резолвит актуальные «latest» на день установки → сборка может сломаться в любой момент без изменений в коде. Критично для воспроизводимости и supply-chain в проде.

---

## 🟠 Высокий приоритет

### 6. Авто-TLS у Caddy сломан нестандартным маппингом портов
`docker-compose.yml:192-193` — `50708:80`, `50709:443`, а прод-блок Caddyfile (`Caddyfile:22` — `docs.{$DOMAIN}`) рассчитывает на авто-выпуск TLS через HTTP-01/TLS-ALPN, которым нужны стандартные 80/443 снаружи. С маппингом на 50xxx автоматические сертификаты не выпустятся.

### 7. Прод-compose хардкодит конфиг-ручки вместо `${VAR}`
`docker-compose.yml:138-146` прописывает явно: `GRAPH_EXTRACT_MIN_CONFIDENCE: 0.5`, `GRAPH_EXPANSION_BOOST: 0.3`, `HYBRID_TEXT_WEIGHT: 0.4`, `HYBRID_SEMANTIC_WEIGHT: 0.6`, `CHUNK_TARGET_TOKENS: 500`, `CHUNK_OVERLAP_TOKENS: 50`, `FOLDER/CATEGORY/TAG_REEMBED_BATCH_SIZE`. Настройка этих значений в `.env` **не имеет эффекта** при запуске через `docker-compose.yml`. Сам `.env.example:4-5` предупреждает «do NOT rely on the docker-compose.yml defaults for prod» — проблема известна, но не устранена.

### 8. `MINIO_PUBLIC_ENDPOINT: localhost` ломает presigned-загрузки за доменом
`docker-compose.yml:114-115` — публичный эндпоинт MinIO захардкожен в `localhost`. Presigned URL'ы для загрузки файлов из браузера будут указывать на `localhost`, и за реальным доменом (через Caddy) загрузки вложений не сработают.

### 9. `minio/minio:latest` не зафиксирован
В обоих compose-файлах (`docker-compose.yml:53`, `docker-compose.dev.yml:47`) — непроизводительно и supply-chain risk.

### 10. Несовпадение registry образов
CI пушит в `vgalibov/hiai-docs:api-<tag>` / `:web-<tag>` (`.github/workflows/ci.yml:322-329`), а `RELEASE_CHECKLIST.md:28` и `docs/PRODUCTION_STATUS.md` говорят про `hiai-gg/hiai-docs:api-v<version>`. Оператор по чек-листу не найдёт образы.

### 11. `main` опережает тег `v0.1.0` на 4 коммита
Тег `v0.1.0` существует (`ef831bf`), но HEAD = `14b3fd9`, и после релиза шли фиксы (`cf03e3e`, `8668c6c`, `9b4f52d` — тесты/CI/`init.sql`). Релизный артефакт отстаёт от HEAD.

---

## 🟡 Средний приоритет

### 12. Расхождения портов по всему репо
Путает оператора, источник правды размыт:
- **DB:** `5433` (PRODUCTION_STATUS, DEPLOYMENT, health-check) vs `5437` (`.env.example:13`, dev-compose) vs default `5433` в prod-compose.
- **MinIO:** `9020` (`.env.example:23`) vs `9000` (compose default, `scripts/health-check.sh:32`) vs консоль `9021`/`9001` (`docs/DEPLOYMENT.md` сам себе противоречит: строка 18 — `9001`, строка 115 — `9000/9021`).
- **Redis:** `6384` (compose) vs `6380` (`scripts/health-check.sh:14,30` — дефолт, и коммент «matches REDIS_URL in .env.example», что неверно) vs внутренний `6379`; `docs/DEPLOYMENT.md:62` пишет дефолт `redis://redis:6384` — ошибка (внутри сети порт 6379).
- **Caddy:** `80/443` (PRODUCTION_STATUS) vs `50708/50709` (compose).

### 13. `docs/PRODUCTION_STATUS.md` устарел
«Last verified: 2026-06-14», последнее изменение файла — `2026-06-20`, а `v0.1.0` и 4 коммита после — уже июль. Утверждение «10 route files» (`:19`) неверно: в `backend/src/api/routes/` **14** файлов (добавились `admin`, `categories`, `graph`, `metrics`). «178/178 tests passing» (`:45`) для текущего HEAD **не проверено**.

### 14. CHANGELOG не обновлён под релиз
`CHANGELOG.md:9` — раздел `## [Unreleased]`, но его «Highlights» (унифицированный postgres-образ и т.д.) уже вошли в тег `v0.1.0`. Блок не переименован в `[0.1.0]` с датой.

### 15. CI проверяет не то, что закоммичено
`.github/workflows/ci.yml` ставит `bun-version: latest`, `npm install -g npm@latest`, `moby/buildkit:latest`; плюс **в рантайме переписывает `package.json`** (фильтрует `hiai-ui` из workspaces, пинит `@hiai-gg/hiai-ui` к `^0.0.1`) — workaround недоступности приватного пакета в CI. То есть CI проверяет граф зависимостей, отличающийся от закоммиченного.

### 16. Фронтенд-Dockerfile тащит весь `node_modules` в runtime
`frontend/Dockerfile:29-30` копирует `node_modules` целиком (вкл. devDeps) — больше образ, больше attack surface. Функционально работает, но для прода неоптимально.

---

## 🟢 Низкий приоритет / гигиена

### 17. `docker-compose.dev.yml` расходится с «унифицированным образом»
Там есть отдельный сервис `age-postgres` и роль `hiai_app` (`docker-compose.dev.yml:103,138-158`), которая **не создаётся** ни в `postgres/init.sql`, ни в Dockerfile (там только `aiuser`). Свежий dev-сетап на `hiai_app` упадёт на аутентификации. Это dev-only, но противоречит AGENTS.md / `postgres/init.sql`.

### 18. Caddyfile, блок `:80`
`Caddyfile:13` — catch-all с dev-CSP (`connect-src 'self' http://localhost:50700 ws://localhost:50700`). Как дефолт-вхост не годится для прода.

### 19. Нет E2E и нет автоматических бэкапов
Зафиксировано в `docs/PRODUCTION_STATUS.md:53-57` — осознанный gap, но для прода стоит держать в голове.

---

## ✅ Что сделано хорошо (для объективности)

- TypeScript strict: `bun run typecheck` — **0 ошибок**, 3 warning'а (фронт).
- Версии **синхронны во всех 6 файлах** (`0.1.0`), включая swagger в `backend/src/index.ts:83`. Тег `v0.1.0` существует.
- Многоступенчатые Dockerfile с **non-root `app`**, `NODE_ENV=production` внутри образов, healthcheck'и.
- Zod-схема конфига с прод-гардом на `BETTER_AUTH_SECRET`; богатый security-набор (CSRF, rate-limit, Argon2id, RLS multi-tenant, CSP/HSTS, Zod-валидация на каждом роуте).
- Postgres-образ хорошо зафиксирован (PG 18.1, pgvector 0.8.3, pgvectorscale 0.9.0, AGE 1.7.0).
- **Нет техдолга по TODO/FIXME в ядре:** 46 совпадений по `TODO|FIXME|HACK|console.log` — **все** в `backend/src/scripts/benchmark-graph.ts` (бенчмарк, не прод-код).
- CI покрывает lint/typecheck/test/docker-build+scan/npm publish с provenance.

---

## Рекомендуемый порядок действий

1. **Безопасность/конфиг:** в `docker-compose.yml` поставить `NODE_ENV: production` и пробросить `CSRF_SECRET`/`WEBHOOK_SECRET` через `${...}`; вынести хардкод `HYBRID_*`/`CHUNK_*`/`GRAPH_*` в `${VAR}`; `MINIO_PUBLIC_ENDPOINT` сделать переменной.
2. **Секреты:** заменить значения в `.env.example` на плейсхолдеры (`change-me`/`generate-with-openssl`), ротировать `BETTER_AUTH_SECRET`/`HIAI_DOCS_API_KEY`, если они использовались в проде.
3. **Caddy:** либо убрать `rate_limit`, либо собрать кастом-образ caddy с модулем `caddy-ratelimit`; вернуть маппинг 80/443 для авто-TLS; валидировать `caddy validate`.
4. **Воспроизводимость:** перестать игнорировать `bun.lock` (зафиксировать его) и заменить `"latest"` на зафиксированные диапазоны.
5. **Доки/CI:** обновить `docs/PRODUCTION_STATUS.md` и `CHANGELOG.md` под `v0.1.0`; свести порты к одному источнику правды; поправить registry в `RELEASE_CHECKLIST.md` (`vgalibov` ↔ `hiai-gg`); валидировать Caddyfile в CI.
6. **Верификация:** прогнать полный `bun test` против отдельной `hiai_docs_test` (как в CI), обновить счётчик тестов.

---

*Файл создан аудит-агентом. Не вносил изменений в остальной репозиторий.*
