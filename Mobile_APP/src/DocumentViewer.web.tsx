import React, { useEffect, useState } from 'react'
import { Image, View } from 'react-native'
import { Warning, Spinner } from './ui'
import type { Viewer } from './types'

export default function DocumentViewer({ document }: { document: Viewer }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const abort = new AbortController()
    let blobURL = ''
    void (async () => {
      const response = await fetch(document.uri, { headers: document.headers, credentials: 'omit', signal: abort.signal })
      if (!response.ok) throw new Error(`Document inaccessible (HTTP ${response.status}).`)
      const blob = await response.blob()
      if (abort.signal.aborted) return
      blobURL = URL.createObjectURL(blob); setUrl(blobURL)
    })().catch((e: Error) => { if (!abort.signal.aborted) setError(e.message) })
    return () => { abort.abort(); if (blobURL) URL.revokeObjectURL(blobURL) }
  }, [document])
  return <View style={{ gap: 12 }}>{error ? <Warning>{error}</Warning> : !url ? <Spinner /> : <>
    {document.mime === 'application/pdf' ? <iframe title={document.title} src={`${url}#page=${document.page || 1}`} style={{ height: 480, width: '100%', border: 0 }} />
      : <Image accessibilityLabel={document.title} source={{ uri: url }} resizeMode="contain" style={{ height: 400, width: '100%' }} />}
    <a href={url} download={document.title}>Télécharger le document</a>
  </>}</View>
}
