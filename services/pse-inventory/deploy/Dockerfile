FROM python:3.13.7-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY vendor/pse-inventory-packet /app/vendor/pse-inventory-packet
COPY services/pse-inventory /app/services/pse-inventory
RUN python -m pip install --upgrade pip==25.2 \
 && python -m pip install -r /app/services/pse-inventory/requirements.runtime.lock \
 && useradd --system --uid 10001 --home /nonexistent --shell /usr/sbin/nologin pse
USER 10001:10001
EXPOSE 8080
ENV PSE_PACKET_ROOT=/app/vendor/pse-inventory-packet
CMD ["python", "-m", "uvicorn", "pse_inventory.server:app", "--app-dir", "/app/services/pse-inventory", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "172.16.0.0/12"]
