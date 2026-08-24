# snapcn on a container host (Coolify, Fly, Railway).
#
# The whole app, not a render-only service. The render pipeline keeps its job
# registry in-process and its MP4s on local disk, so the routes that touch them
# (/api/render, /api/audio, /api/showcase) have to be the same process that
# serves the editor. Splitting them would mean cross-origin auth and a second
# deployment to keep in step, for nothing.
#
# See SHOWCASE_SETUP.md §5 for the volume and the one-replica rule.

FROM node:22-bookworm-slim

# Shared libraries Chrome Headless Shell links against. Without them a render
# dies with "Failed to launch Chrome" and no other clue. fonts-liberation is
# here so text with no webfont renders as glyphs rather than tofu.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 \
      libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 \
      libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
      fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Everything is copied before install because `postinstall` runs fumadocs-mdx,
# which reads content/. A package.json-only layer would fail there.
COPY . .

RUN corepack enable && pnpm install --frozen-lockfile

# Three build steps, and the order is load-bearing:
#  1. next build      — the site.
#  2. bundle:remotion — writes .remotion-bundle/, which getServeUrl() prefers.
#     Skip it and the first export of every deploy pays for a webpack bundle
#     inside the request.
#  3. remotion:browser — downloads Chrome Headless Shell now rather than on the
#     first render. `npx remotion browser ensure` does NOT work here: that CLI
#     lives in @remotion/cli, which this project does not install.
RUN pnpm run build \
 && pnpm run bundle:remotion \
 && pnpm run remotion:browser

# Where the render pipeline keeps its files. Mount ONE volume at /data so
# promoting a render to the showcase stays a rename instead of a copy.
ENV RENDER_WORK_DIR=/data/renders \
    AUDIO_WORK_DIR=/data/audio \
    SHOWCASE_WORK_DIR=/data/showcase
VOLUME ["/data"]

EXPOSE 3000
CMD ["pnpm", "start"]
