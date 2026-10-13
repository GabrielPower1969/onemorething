# Local development container (the production runtime is Cloudflare workerd, not this image).
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
# compose runs as ${OMT_UID}; the dev server writes caches under /app.
RUN chmod -R a+rwX /app
EXPOSE 4321
CMD ["sh", "-c", "node scripts/copy-fonts.mjs && npx wrangler d1 migrations apply omt --local && npx astro dev --host 0.0.0.0 --port 4321"]
