import { useEffect, useRef, useState } from 'react'
import { generateInterviewSpeech } from '../api.js'

export function useInterviewSpeech({ phase, stage, question, index, paused, mode, micOn, typing }) {
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [replay, setReplay] = useState(0)
  const lastRequest = useRef('')
  useEffect(() => {
    let disposed = false
    let objectUrl = ''
    const controller = new AbortController()
    setAudioUrl('')
    setStatus('idle')
    const active = phase === 'running' && (stage === 'asking' || stage === 'feedback') && !paused && !micOn && !typing && mode !== 'text' && enabled && question
    const key = `${index}:${question}:${replay}`
    if (active && key !== lastRequest.current) {
      lastRequest.current = key
      setStatus('generating')
      setError('')
      generateInterviewSpeech(question.slice(0, 1000), controller.signal).then(blob => {
        if (disposed) return
        objectUrl = URL.createObjectURL(blob)
        setAudioUrl(objectUrl)
        setStatus('playing')
      }).catch(err => {
        if (disposed || err.name === 'AbortError') return
        setStatus('idle')
        setError(err.message || '语音生成失败，可继续文字作答')
      })
    }
    return () => {
      disposed = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [phase, stage, question, index, paused, mode, micOn, typing, enabled, replay])
  return {
    enabled, setEnabled, status, error, audioUrl,
    readyForAnswer: (!enabled || status === 'idle') && (lastRequest.current === `${index}:${question}:${replay}` || !enabled),
    replay: () => setReplay(n => n + 1),
    onPlaybackEnd: () => { setAudioUrl(''); setStatus('idle') },
    onPlaybackError: () => { setAudioUrl(''); setStatus('idle'); setError('音频未能播放，请点击「重播问题」重试，或继续文字作答。') },
  }
}
