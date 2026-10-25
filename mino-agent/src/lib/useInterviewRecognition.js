import { useEffect, useRef, useState } from 'react'

/** Real browser speech recognition. No mock transcripts; unsupported browsers get text fallback. */
export function useInterviewRecognition({ active, onText, onAnswer, onListening }) {
  const callbacks = useRef({ onText, onAnswer, onListening })
  callbacks.current = { onText, onAnswer, onListening }
  const [error, setError] = useState('')
  const [interim, setInterim] = useState('')
  const [retry, setRetry] = useState(0)
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  useEffect(() => {
    if (!active || !supported) return
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new Recognition()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    let disposed = false, failed = false, finalText = ''
    setError(''); setInterim('')
    recognition.onstart = () => { if (!disposed) callbacks.current.onListening(true) }
    recognition.onresult = event => {
      if (disposed) return
      let final = '', partial = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript
        else partial += event.results[i][0].transcript
      }
      finalText = final.trim()
      setInterim(partial)
      callbacks.current.onText((final + partial).trim())
    }
    recognition.onerror = event => {
      if (disposed) return
      failed = true
      const messages = { 'not-allowed': '麦克风或语音识别权限未获授权，请允许后重试。', 'audio-capture': '未找到可用麦克风。', network: '浏览器语音识别服务连接失败，请重试或用文字作答。', 'no-speech': '暂未识别到语音，点击继续收音。' }
      setError(messages[event.error] || `语音识别中断：${event.error}`)
    }
    recognition.onend = () => {
      if (disposed) return
      callbacks.current.onListening(false)
      setInterim('')
      if (!failed && finalText) callbacks.current.onAnswer(finalText)
      else if (!failed) setError('暂未识别到完整回答，点击继续收音。')
    }
    try { recognition.start() } catch { setError('无法启动语音识别，请点击重试。') }
    return () => { disposed = true; recognition.abort(); callbacks.current.onListening(false) }
  }, [active, supported, retry])
  return { supported, error, interim, retry: () => setRetry(v => v + 1) }
}
