FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /tmp/highlight-service

ENV PORT=8080
EXPOSE 8080

# Pull prepared demo footage + annotation cache from GCS before serving.
# The assets are too large for `railway up`; sync_demo_assets.py is the
# path that keeps the demo console ready on a fresh container.
CMD python scripts/sync_demo_assets.py download && uvicorn main:app --host 0.0.0.0 --port $PORT
