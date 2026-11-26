FROM python:3.13-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 DATABASE_PATH=/data/orders.sqlite3

RUN groupadd --system shop && useradd --system --gid shop shop && mkdir /data && chown shop:shop /data
COPY server.py products.json index.html script.js style.css ./

USER shop
EXPOSE 8000
CMD ["python", "server.py"]
