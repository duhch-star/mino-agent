import { useEffect, useRef, useState } from 'react'
import { createInterviewRecognition } from './interview-recognition.mjs'
export function useInterviewRecognition({ active, autoSubmit = false, initialText = '', onText, onAnswer, onListening }) {
  const draft = useRef(initialText)
  draft.current = initialText
  const callbacks = useRef({ onText, onAnswer, onListening })
  callbacks.current = { onText, onAnswer, onListening }
  const [error, setError] = useState('')
  const [interim, setInterim] = useState('')
  const [retry, setRetry] = useState(0)
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  useEffect(() => {
    if (!active || !supported) return
    setError(''); setInterim('')
    const controller = createInterviewRecognition({ Recognition: window.SpeechRecognition || window.webkitSpeechRecognition,
      onText: text => callbacks.current.onText(text), onInterim: setInterim,
      onListening: value => callbacks.current.onListening(value),
      onAnswer: text => callbacks.current.onAnswer(text), onError: setError, autoSubmit, initialText: draft.current,
    })
    return () => { controller.stop() }
  }, [active, supported, retry, autoSubmit])
  return { supported, error, interim, retry: () => setRetry(v => v + 1) }
}
