import { useEffect, useRef, useState } from 'react'
import { generateInterviewSpeech } from '../api.js'
import { createInterviewAudio } from './interview-audio.mjs'

export function useInterviewSpeech({ phase, stage, question, index, paused, mode, typing }) {
  const [enabled, setEnabled] = useState(true)
  const [provider, setProvider] = useState('auto')
  const [rate, setRate] = useState(1)
  const [voiceURI, setVoiceURI] = useState('')
  const [voices, setVoices] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState({ provider: 'auto', firstAudioMs: null })
  const [replay, setReplay] = useState(0)
  const [settled, setSettled] = useState('')
  const player = useRef(null)
  const turn = `${index}:${stage}:${question}:${replay}:${provider}:${rate}:${voiceURI}`
  useEffect(() => {
    const update = () => setVoices(window.speechSynthesis?.getVoices().filter(v => /^zh/i.test(v.lang)) || [])
    update(); window.speechSynthesis?.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', update)
  }, [])
  useEffect(() => {
    if (phase !== 'running' || !['asking', 'feedback'].includes(stage) || paused || typing || mode === 'text' || !enabled || !question) { setStatus('idle'); return }
    let disposed = false
    const controller = createInterviewAudio({ fetchAudio: generateInterviewSpeech,
      onState: value => { if (!disposed) { setStatus(value); if (value === 'idle') setSettled(turn) } },
      onError: value => { if (!disposed) setError(value) },
      onMetrics: value => { if (!disposed) setMetrics(value) },
    })
    player.current = controller; setError(''); setSettled('')
    controller.speak(question.slice(0, 1000), { provider, rate, voiceURI })
    return () => { disposed = true; controller.stop(); if (player.current === controller) player.current = null }
  }, [phase, stage, question, index, paused, mode, typing, enabled, replay, provider, rate, voiceURI])
  const stop = () => { player.current?.stop(); setStatus('idle'); setSettled(turn) }
  return { enabled, setEnabled, provider, setProvider, rate, setRate, voiceURI, setVoiceURI, voices,
    status, error, metrics, stop,
    readyForAnswer: !enabled || (status === 'idle' && settled === turn),
    replay: () => setReplay(n => n + 1),
  }
}
