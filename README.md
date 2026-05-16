# KuSaFe Frontend

React/Vite frontend для KuSaFe, платформы образовательных игр, квизов и опросов с AI-инструментами, модерацией, рейтингами, статистикой и полноценным production deploy через Docker.

## Фичи платформы

- Каталог игр `/games` с блоком рекомендуемых игр и общим списком.
- Карточки игр с Markdown-описанием, автором, количеством заданий, прохождениями и рейтингом.
- Главная страница-портал, страница `/about` с контактами и картой, отзывы платформы.
- Авторский кабинет `/my-games` для создания и редактирования игр.
- Типы заданий: викторина, верно/неверно, порядок, открытый ответ, опрос, множественный выбор.
- Markdown или plain-text описание игры.
- Настройка цвета игры через полноценный color picker.
- Приватные игры, доступные только по ссылке.
- Копирование публичной ссылки на игру.
- Ограничение максимального количества попыток.
- Ограничение доступности игры по датам и времени.
- AI-модерация игры перед публикацией.
- AI-инструменты автора: переписать текст, придумать неправильный вариант, придумать новую задачу.
- Прохождение игры с таймером, прогрессом и разными интерфейсами под тип задания.
- Страница результата с баллами, временем, отзывом, лидербордом.
- Просмотр своих ответов после прохождения в read-only режиме.
- AI-кнопка `Объяснить`, которая кратко объясняет правильный ответ через Ollama.
- Лидерборд идеальных прохождений.
- Отзывы к играм и сайту.
- Админский режим для управления играми и отзывами.
- Статистика автора: средний балл, время, точность, прогресс-бары, CSV export, последние открытые ответы с пагинацией.

## Стек

- React 19
- TypeScript
- Vite
- SCSS modules
- Chakra UI toaster/provider
- lucide-react icons
- marked + DOMPurify для Markdown
- Playwright E2E
- Vitest
- Docker + nginx

## Локальный запуск

```bash
cd app
npm ci
npm run dev
```

По умолчанию frontend ждёт backend из `VITE_API_BASE_URL`. Для локального запуска:

```bash
set VITE_API_BASE_URL=http://127.0.0.1:5267
npm run dev -- --host 127.0.0.1 --port 5174
```

Backend можно запустить из соседнего репозитория:

```bash
cd ..\..\KuSaFeBackend
dotnet run --project KuSaFeBackend.csproj --urls http://127.0.0.1:5267
```

## Проверки

```bash
cd app
npm run build
npm test
npm run test:e2e
```

E2E поднимает реальный backend через Playwright `webServer` и использует deterministic AI provider. Для smoke-теста реального Ollama:

```bash
set KUSAFE_E2E_OLLAMA=1
npm run test:e2e:ollama
```

## Docker

Production image собирает Vite static bundle и отдаёт его через nginx внутри frontend-контейнера:

```bash
docker build -t kusafe-frontend .
docker run --rm -p 5549:80 kusafe-frontend
```

В production frontend использует `/api`, поэтому системный nginx на сервере проксирует `/api/` на backend.

## Production deploy

Файлы деплоя находятся в `deploy/`:

- `docker-compose.prod.yml` - сервисы `frontend`, `backend`, `postgres`, `ollama`;
- `nginx.host.conf` - HTTPS reverse proxy для системного nginx на `kusafe.nk.ax`;
- `.env.example` - пример переменных сервера.

Первичная подготовка Ubuntu 22.04:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
sudo mkdir -p /opt/kusafe
sudo chown "$USER:$USER" /opt/kusafe
```

Создать `/opt/kusafe/.env`:

```env
POSTGRES_DB=kusafe_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me
JWT_KEY=replace-with-at-least-64-random-characters
OLLAMA_MODEL=llama3.1:8b
BACKEND_TAG=main
FRONTEND_TAG=main
```

Сертификаты ожидаются в стандартном Let’s Encrypt пути:

```bash
sudo certbot certonly --nginx -d kusafe.nk.ax
```

Установить системный nginx config можно так:

```bash
sudo cp /opt/kusafe/nginx.host.conf /etc/nginx/sites-available/kusafe.nk.ax
sudo ln -sf /etc/nginx/sites-available/kusafe.nk.ax /etc/nginx/sites-enabled/kusafe.nk.ax
sudo nginx -t
sudo systemctl reload nginx
```

После первого deploy нужно загрузить модель Ollama:

```bash
cd /opt/kusafe
docker compose -f docker-compose.prod.yml exec ollama ollama pull llama3.1:8b
```

## CI/CD

GitHub Actions workflow `.github/workflows/ci-cd.yml` делает:

- checkout frontend;
- checkout backend в соседнюю папку для real-stack E2E;
- `npm ci`;
- `npm run build`;
- `npm test`;
- установка Chromium через `npx playwright install --with-deps chromium`;
- `npm run test:e2e`;
- сборка Docker image;
- push в GHCR как `ghcr.io/kusafe-2025/frontend:<branch>` и `<sha>`;
- загрузка `deploy/docker-compose.prod.yml` и `deploy/nginx.host.conf` на сервер;
- bootstrap `/opt/kusafe` и `.env`, если это первый deploy;
- авторизация сервера в private GHCR;
- `docker compose pull frontend`;
- `docker compose up -d postgres ollama frontend`;
- healthcheck frontend на `127.0.0.1:5549`.

Нужные GitHub secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PORT`
- `PROD_POSTGRES_PASSWORD`
- `PROD_JWT_KEY`
- `GHCR_READ_USER`
- `GHCR_READ_TOKEN`

`GHCR_READ_TOKEN` нужен для pull private packages на сервере. Создайте GitHub PAT с `read:packages` и сохраните его в secret. Push в GHCR выполняется через встроенный `GITHUB_TOKEN`.

Backend repository имеет отдельный workflow, который собирает backend image и перезапускает `postgres`, `ollama`, `backend` на том же compose. Оба workflow могут быть запущены первыми на пустом сервере: каждый доставляет compose и создаёт `.env`, если файла ещё нет.
