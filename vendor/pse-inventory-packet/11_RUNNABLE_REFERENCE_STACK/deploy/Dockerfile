FROM python:3.13.7-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /packet
COPY . /packet
RUN python -m pip install --upgrade pip==25.2 \
 && python -m pip install -r /packet/11_RUNNABLE_REFERENCE_STACK/requirements.runtime.lock \
 && useradd --system --uid 10001 --home /nonexistent --shell /usr/sbin/nologin pse
USER 10001:10001
EXPOSE 8080
CMD ["python", "-m", "uvicorn", "app.server:app", "--app-dir", "/packet/11_RUNNABLE_REFERENCE_STACK", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "172.16.0.0/12"]
