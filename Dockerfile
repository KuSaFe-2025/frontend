FROM node:20-bullseye AS build

WORKDIR /src

COPY app/package.json app/package-lock.json ./
RUN npm ci

COPY app ./
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.app.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80
