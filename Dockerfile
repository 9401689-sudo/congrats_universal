FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/renderer-venv

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY renderer ./renderer
RUN /opt/renderer-venv/bin/pip install --no-cache-dir -r renderer/requirements.txt

COPY --from=build /app/dist ./dist
COPY README.md ./

ENV PYTHON_RENDERER_BIN=/opt/renderer-venv/bin/python
ENV PYTHON_RENDERER_SCRIPT_PATH=/app/renderer/legacy/render_doc.py

EXPOSE 3000

CMD ["node", "--enable-source-maps", "dist/index.js"]
