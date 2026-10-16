import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { fetch as expoFetch } from 'expo/fetch'
import type { Viewer } from './types'

const configured = process.env.EXPO_PUBLIC_API_URL
export const baseURL = (configured || (Platform.OS === 'android' ? 'http://10.0.2.2:4174' : 'http://127.0.0.1:4174')).replace(/\/$/, '')
const origin = new URL(baseURL).origin
if (!__DEV__ && !baseURL.startsWith('https://')) throw new Error('Une adresse API HTTPS est requise pour une application de production.')
let token: string | null = null
const storageKey = 'egova-native-token'

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}
export const absoluteURL = (path: string) => {
  const url = new URL(path, `${baseURL}/`)
  if (url.origin !== origin) throw new Error('Source extérieure au serveur configuré refusée.')
  return url.toString()
}
export const nativePath = (path: string) => path.replace(/^\/workspace-api\//, '/native-api/')
export const authorization = (): Record<string, string> => token ? { Authorization: `Bearer ${token}` } : {}

export async function restoreToken() {
  token = Platform.OS === 'web' ? null : await SecureStore.getItemAsync(storageKey)
  return token
}
export async function storeToken(value: string | null) {
  if (Platform.OS !== 'web') {
    if (value) await SecureStore.setItemAsync(storageKey, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
    else await SecureStore.deleteItemAsync(storageKey)
  }
  token = value
}
export async function request<T>(path: string, method = 'GET', data?: Record<string, unknown> | FormData): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...authorization() }
  const isForm = data instanceof FormData
  if (data && !isForm) headers['Content-Type'] = 'application/json'
  const response = await expoFetch(absoluteURL(path), {
    method, headers, credentials: 'omit', signal: AbortSignal.timeout(45000),
    body: data ? (isForm ? data : JSON.stringify(data)) : undefined,
  })
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new ApiError(`Service indisponible (HTTP ${response.status}).`, response.status)
  const body = await response.json()
  if (!response.ok) throw new ApiError(body.error || `Erreur HTTP ${response.status}`, response.status)
  return body as T
}
export const api = <T>(path: string, method = 'GET', data?: Record<string, unknown> | FormData) => request<T>(`/native-api/${path}`, method, data)

export async function privateViewer(path: string, title: string): Promise<Viewer> {
  const uri = absoluteURL(nativePath(path))
  const headers = authorization()
  const response = await fetch(uri, { method: 'HEAD', headers, credentials: 'omit', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new ApiError(`Document inaccessible (HTTP ${response.status}).`, response.status)
  const mime = (response.headers.get('content-type') || '').split(';')[0]
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(mime)) throw new Error('Format non visualisable.')
  return { title, uri, headers, mime }
}
