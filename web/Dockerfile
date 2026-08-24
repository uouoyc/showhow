FROM node:24.14.0 AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

FROM base AS dependencies

RUN python3 --version && make --version && g++ --version

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY extension/package.json ./extension/package.json
COPY web/package.json ./web/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY . .
RUN pnpm --filter web build

FROM node:24.14.0 AS runner

ENV DATA_DIR=/data
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

WORKDIR /app

RUN mkdir -p /data && chown node:node /data

COPY --from=builder --chown=node:node /app/web/.next/standalone ./

USER node
WORKDIR /app/web

EXPOSE 3000

CMD ["node", "server.js"]
