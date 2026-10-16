export function startDictation({ consent, onText, onState, onError }) {
  const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition
  if (!consent) {
    onError('Autorisez la dictée après avoir lu l’avertissement de confidentialité.')
    return null
  }
  if (!Recognition) {
    onError('Dictée indisponible dans ce navigateur. Utilisez le texte ou la dictée de votre clavier.')
    return null
  }
  if (!globalThis.isSecureContext) {
    onError('Le microphone nécessite HTTPS ou une adresse locale de développement.')
    return null
  }
  const recognition = new Recognition()
  recognition.lang = 'fr-FR'
  recognition.continuous = false
  recognition.interimResults = false
  let active = true
  recognition.onresult = (event) => {
    if (!active) return
    const transcript = Array.from(event.results).filter((r) => r.isFinal).map((r) => r[0].transcript).join(' ')
    if (transcript) onText(transcript)
  }
  recognition.onerror = (event) => {
    if (!active) return
    const reasons = {
      'not-allowed': 'Accès au microphone refusé.',
      'service-not-allowed': 'Service de reconnaissance vocale non autorisé.',
      'no-speech': 'Aucune parole détectée. Réessayez ou écrivez votre commande.',
      'audio-capture': 'Aucun microphone utilisable.',
      network: 'Service vocal indisponible ou connexion interrompue.',
    }
    onError(reasons[event.error] || `Dictée interrompue : ${event.error}.`)
  }
  recognition.onend = () => { active = false; onState(false) }
  try {
    recognition.start()
    onState(true)
  } catch (error) {
    active = false
    onError(`Impossible de démarrer la dictée : ${error.message}`)
    return null
  }
  return () => { active = false; recognition.abort(); onState(false) }
}
