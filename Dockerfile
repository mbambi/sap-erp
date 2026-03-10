FROM node:20-alpine AS base
WORKDIR /app

# Build server
FROM base AS server-deps
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install

FROM server-deps AS server-build
COPY server/ ./server/
RUN cd server && npx prisma generate && npm run build

# Build client
FROM base AS client-deps
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install

FROM client-deps AS client-build
COPY client/ ./client/
RUN cd client && npm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/package.json ./server/
COPY --from=server-build /app/server/prisma ./server/prisma
COPY --from=client-build /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/server
CMD ["node", "dist/index.js"]
