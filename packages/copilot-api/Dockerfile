# SPDX-License-Identifier: Apache-2.0
# Build from repository root: docker build -f packages/copilot-api/Dockerfile -t lux-copilot-api .
#
# Multi-stage build: the first stage installs workspace dependencies for
# @lux/copilot-api and its workspace dependencies (@lux/model-gateway), builds
# TypeScript, and prunes to production dependencies. The runtime stage copies
# the pruned node_modules trees plus both packages so Node can resolve the
# workspace link (@lux/model-gateway) and its transitive dependencies while
# keeping a single container.
FROM node:20-slim AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/model-gateway packages/model-gateway
COPY packages/copilot-api packages/copilot-api
RUN pnpm install --frozen-lockfile --filter @lux/copilot-api... \
 && pnpm --filter @lux/copilot-api... run build \
 && pnpm --filter @lux/copilot-api... prune --prod

FROM node:20-slim
USER node
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/model-gateway ./packages/model-gateway
COPY --from=build --chown=node:node /app/packages/copilot-api/dist ./packages/copilot-api/dist
# Per-package node_modules carry the workspace symlink to @lux/model-gateway
# and the pnpm links into the pruned root store; without it, dist/index.js
# cannot resolve fastify or the gateway from its location.
COPY --from=build --chown=node:node /app/packages/copilot-api/node_modules ./packages/copilot-api/node_modules
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "packages/copilot-api/dist/index.js"]
