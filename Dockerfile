FROM node:24-alpine

RUN corepack enable \
  && apk add --no-cache mariadb-client

WORKDIR /patient-lookup

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile

COPY . .

EXPOSE 8080

CMD ["corepack", "pnpm", "dev", "--host", "0.0.0.0"]
