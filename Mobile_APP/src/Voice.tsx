import React, { useEffect, useState } from 'react'
import { AppState, View } from 'react-native'
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition'
import { Body, Button, Toggle, Warning } from './ui'

export default function Voice({ onText, disabled }: { onText: (text: string) => void; disabled: boolean }) {
  const [consent, setConsent] = useState(false)
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  useSpeechRecognitionEvent('start', () => setActive(true))
  useSpeechRecognitionEvent('end', () => setActive(false))
  useSpeechRecognitionEvent('result', (event) => { if (event.isFinal && event.results[0]?.transcript) onText(event.results[0].transcript) })
  useSpeechRecognitionEvent('error', (event) => { setError(`Dictée interrompue : ${event.message || event.error}`); setActive(false) })
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state !== 'active') ExpoSpeechRecognitionModule.abort() })
    return () => { listener.remove(); ExpoSpeechRecognitionModule.abort() }
  }, [])
  useEffect(() => { if (disabled || !consent) ExpoSpeechRecognitionModule.abort() }, [disabled, consent])
  const start = async () => {
    try {
      setError('')
      if (active) { ExpoSpeechRecognitionModule.stop(); return }
      if (!consent) throw new Error('Votre consentement est requis avant la dictée.')
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) throw new Error('Dictée indisponible sur cet appareil. Utilisez la saisie texte.')
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
      if (!permission.granted) throw new Error('Microphone ou reconnaissance vocale non autorisé. Vérifiez les réglages de l’appareil.')
      ExpoSpeechRecognitionModule.start({ lang: 'fr-FR', interimResults: false, continuous: false, maxAlternatives: 1 })
    } catch (e) { setError(e instanceof Error ? e.message : 'Dictée indisponible.') }
  }
  return <View style={{ gap: 10 }}>
    <Toggle label="J’autorise la dictée : l’audio peut être envoyé au fournisseur vocal. Aucune donnée confidentielle." value={consent} onChange={setConsent} />
    <Button secondary title={active ? 'Arrêter la dictée' : 'Dicter ma commande'} disabled={disabled} onPress={() => void start()} />
    {error ? <Warning>{error}</Warning> : <Body>{active ? 'Écoute en cours…' : 'Relisez le texte avant d’envoyer. La voix ne confirme jamais une action.'}</Body>}
  </View>
}
