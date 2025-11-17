FROM node:20-bullseye

WORKDIR /home/app

# Копируем только package.json и yarn.lock из app/
COPY app/package.json app/yarn.lock ./

RUN yarn config set registry https://registry.npmjs.org

RUN yarn install --frozen-lockfile

# ARM64-specific fix
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then \
      echo "Installing rollup-linux-arm64-gnu for ARM64..."; \
      yarn add --dev @rollup/rollup-linux-arm64-gnu --ignore-scripts; \
      npm rebuild esbuild; \
    fi

# Копируем весь исходный код из папки app/
COPY app .

ENV NODE_OPTIONS=--max-old-space-size=4096

# Сборка
RUN yarn build

# Копируем entrypoint и даём права на исполнение
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

EXPOSE ${PORT}
