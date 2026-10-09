# Gunicorn settings, picked up automatically by `gunicorn main:app` (Render's start command).
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
# One process with several threads: fits Render's free instance and keeps per-process
# state (rate limits, caches) consistent.
workers = int(os.environ.get('WEB_CONCURRENCY', '1'))
worker_class = 'gthread'
threads = int(os.environ.get('GUNICORN_THREADS', '8'))
# A sleeping free instance can take a while to reach MongoDB on its first request.
timeout = 120
graceful_timeout = 30
keepalive = 5
