# syntax=docker/dockerfile:1
FROM node:20-bookworm AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 使用缓存挂载优化 apt 安装
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
      ffmpeg \
      g++ \
      libgl1-mesa-dev \
      libgl1-mesa-dri \
      libglu1-mesa-dev \
      libosmesa6 \
      libx11-dev \
      libxext-dev \
      libxi-dev \
      fontconfig \
      make \
      mesa-utils \
      pkg-config \
      python3 \
      xauth \
      xvfb
RUN ln -sf /usr/bin/python3 /usr/local/bin/python

COPY assets/fonts /usr/share/fonts/open-director
RUN fc-cache -fv

FROM base AS deps
# 只复制依赖相关的文件，最大化缓存命中
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/render/package.json apps/render/package.json

# 使用缓存挂载优化 pnpm 安装
RUN --mount=type=cache,target=/pnpm/store,sharing=locked \
    --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile

FROM deps AS builder
# 复制源代码（注意：这里会破坏缓存，但这是必要的）
COPY . .
RUN pnpm --filter @open-director/web build
RUN pnpm --filter @open-director/render build

FROM base AS web-runner
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM base AS render-runner
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/apps/render ./apps/render
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/render/node_modules ./apps/render/node_modules
WORKDIR /app/apps/render
CMD ["pnpm", "worker"]
