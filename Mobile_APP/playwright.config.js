import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4186',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: [{
    command: 'npm start',
    env: { PORT: '4186', DJANGO_URL: 'http://127.0.0.1:8016' },
    url: 'http://127.0.0.1:4186/api/catalogue',
    reuseExistingServer: false,
    timeout: 30000,
  }, {
    command: '../django_backend/.venv/bin/python ../django_backend/manage.py migrate --noinput && ../django_backend/.venv/bin/python ../django_backend/manage.py import_corpus && ../django_backend/.venv/bin/python ../django_backend/manage.py runserver 127.0.0.1:8016 --noreload',
    env: {
      DJANGO_DEBUG: '1',
      DJANGO_DB_PATH: '../django_backend/db.e2e.sqlite3',
      DJANGO_MEDIA_ROOT: '../django_backend/private_media/e2e',
      DJANGO_CSRF_TRUSTED_ORIGINS: 'http://127.0.0.1:4186',
      GEMINI_API_KEY: '',
    },
    url: 'http://127.0.0.1:8016/workspace-api/session/',
    reuseExistingServer: false,
    timeout: 60000,
  }],
})
