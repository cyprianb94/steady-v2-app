FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY landing/package.json landing/package.json
COPY packages/app/package.json packages/app/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/server/package.json packages/server/package.json

RUN npm ci --workspace @steady/types --workspace @steady/server

COPY packages/types packages/types
COPY packages/server packages/server

RUN npm run build -w packages/types \
  && npm run build -w packages/server

FROM node:22-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY landing/package.json landing/package.json
COPY packages/app/package.json packages/app/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/server/package.json packages/server/package.json

RUN npm ci --omit=dev --workspace @steady/types --workspace @steady/server \
  && npm cache clean --force

COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/packages/server/dist packages/server/dist

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "packages/server"]
