# ── Build stage ──
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Serve stage ──
FROM httpd:2.4-alpine
COPY --from=build /app/dist /usr/local/apache2/htdocs/
COPY httpd-rewrite.conf /usr/local/apache2/conf/conf.d/rewrite.conf
# Load mod_dir (for FallbackResource) and include our config.
RUN sed -i 's|#LoadModule dir_module|LoadModule dir_module|' /usr/local/apache2/conf/httpd.conf \
 && echo "Include conf/conf.d/rewrite.conf" >> /usr/local/apache2/conf/httpd.conf
EXPOSE 80
