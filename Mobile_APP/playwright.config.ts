import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

const root = `${resolve(__dirname, '..')}/`
const django = `${root}django_backend`
export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 60000,
  outputDir: './test-results',
  use: { baseURL: 'http://127.0.0.1:8082', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: [{
    command: `${django}/.venv/bin/python ${django}/manage.py migrate --noinput && ${django}/.venv/bin/python ${django}/manage.py import_corpus && ${django}/.venv/bin/python ${django}/manage.py runserver 127.0.0.1:8017 --noreload`,
    env: { DJANGO_DEBUG: '1', DJANGO_DB_PATH: `${django}/db.expo-test.sqlite3`, DJANGO_MEDIA_ROOT: `${django}/private_media/expo-test`, GEMINI_API_KEY: '' },
    url: 'http://127.0.0.1:8017/workspace-api/session/', timeout: 90000, reuseExistingServer: false,
  }, {
    command: `node ${root}backend/server.mjs`,
    env: { PORT: '4187', DJANGO_URL: 'http://127.0.0.1:8017', CLIENT_ORIGINS: 'http://127.0.0.1:8082' },
    url: 'http://127.0.0.1:4187/api/catalogue', timeout: 40000, reuseExistingServer: false,
  }, {
    command: 'npx expo start --localhost --port 8082',
    env: { CI: '1', APP_VARIANT: 'development', EXPO_PUBLIC_API_URL: 'http://127.0.0.1:4187' },
    url: 'http://127.0.0.1:8082', timeout: 90000, reuseExistingServer: false,
  }],
})
