import React, { useEffect, useRef, useState } from 'react'
import { Image, View } from 'react-native'
import Pdf from 'react-native-pdf'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Body, Button, Warning } from './ui'
import type { Viewer } from './types'

export default function DocumentViewer({ document }: { document: Viewer }) {
  const [error, setError] = useState('')
  const [sharing, setSharing] = useState(false)
  const cached = useRef<string | null>(null)
  useEffect(() => () => {
    if (cached.current) void FileSystem.deleteAsync(cached.current, { idempotent: true }).catch((e: Error) => console.error('Nettoyage du lecteur PDF :', e.message))
  }, [])
  const share = async () => {
    setSharing(true); setError('')
    let path: string | null = null
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Partage indisponible sur cet appareil.')
      if (!FileSystem.cacheDirectory) throw new Error('Stockage temporaire indisponible.')
      path = `${FileSystem.cacheDirectory}document-${Date.now()}.${document.mime === 'application/pdf' ? 'pdf' : document.mime === 'image/png' ? 'png' : 'jpg'}`
      const result = await FileSystem.downloadAsync(document.uri, path, { headers: document.headers })
      if (result.status !== 200) throw new Error(`Téléchargement impossible (HTTP ${result.status}).`)
      await Sharing.shareAsync(path, { mimeType: document.mime, dialogTitle: document.title })
    } catch (e) { setError(e instanceof Error ? e.message : 'Partage impossible.') }
    finally {
      if (path) {
        try { await FileSystem.deleteAsync(path, { idempotent: true }) }
        catch (e) { setError(`Impossible de nettoyer le fichier temporaire : ${String(e)}`) }
      }
      setSharing(false)
    }
  }
  return <View style={{ gap: 12 }}>
    {error ? <Warning>{error}</Warning> : null}
    {document.mime === 'application/pdf'
      ? <Pdf source={{ uri: document.uri, headers: document.headers, cache: false }} trustAllCerts={false}
        page={document.page || 1} style={{ height: 480, width: '100%' }}
        onLoadComplete={(_, path) => { cached.current = path.startsWith('file:') ? path : `file://${path}` }}
        onError={(e) => setError(`Lecture PDF impossible : ${String(e)}`)} />
      : <Image accessibilityLabel={document.title} source={{ uri: document.uri, headers: document.headers }}
        resizeMode="contain" style={{ width: '100%', height: 400 }} onError={() => setError('Image inaccessible ou invalide.')} />}
    <Body>Fichier privé : ne le partagez qu’avec un destinataire autorisé. Aucun document n’est envoyé à Gemini.</Body>
    <Button title="Partager / ouvrir dans une autre application" onPress={() => void share()} disabled={sharing} secondary />
  </View>
}
