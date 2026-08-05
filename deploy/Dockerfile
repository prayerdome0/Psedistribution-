# ─────────────────────────────────────────────────────────────────────────────
# Pilot Sales Distribution — Static storefront image
# ─────────────────────────────────────────────────────────────────────────────
# This image serves the static HTML/CSS/JS storefront. It is intentionally
# minimal: nginx:alpine with the repo root as the document root, the right
# MIME map, and a hardened nginx.conf.
#
# Build:  docker build -t pse-storefront -f deploy/Dockerfile .
# Run:    docker run --rm -p 8080:80 pse-storefront
# Test:   curl http://localhost:8080/products
# ─────────────────────────────────────────────────────────────────────────────

FROM nginx:1.27.3-alpine

# Drop the default config and replace with our hardened version
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/pse.conf

# Copy the entire repo as the document root. .dockerignore prevents
# secrets, .env, the giant zip, and build artifacts from being baked in.
COPY . /usr/share/nginx/html

# Make sure nginx can read all files and the cache dirs are writable
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx \
 && touch /var/run/nginx.pid \
 && chown nginx:nginx /var/run/nginx.pid

# Run as the unprivileged "nginx" user (uid 101) from the base image
USER nginx

EXPOSE 80

# Quick healthcheck against the 404 page (always served by nginx, no DB dep)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/404.html > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
