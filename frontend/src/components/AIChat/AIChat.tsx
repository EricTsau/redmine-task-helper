import { useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import HoverCopy from '../HoverCopy/HoverCopy'

type Message = { id: string; role: 'user' | 'assistant'; content: string }

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortCtrl = useRef<AbortController | null>(null)

  async function send() {
    if (!input.trim()) return
    const userMsg: Message = { id: String(Date.now()), role: 'user', content: input }
    setMessages((s) => [...s, userMsg])
    setInput('')

    const assistantMsg: Message = { id: String(Date.now() + 1), role: 'assistant', content: '' }
    setMessages((s) => [...s, assistantMsg])

    setStreaming(true)
    abortCtrl.current = new AbortController()
    try {
      const res = await fetch('/api/aichat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg.content }),
        signal: abortCtrl.current.signal,
      })

      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      while (!done) {
        const { value, done: d } = await reader.read()
        done = d
        if (value) {
          const chunk = decoder.decode(value)
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            const updated = { ...last, content: last.content + chunk }
            return [...prev.slice(0, -1), updated]
          })
        }
      }
    } catch (err) {
      console.error('stream error', err)
    } finally {
      setStreaming(false)
      abortCtrl.current = null
    }
  }

  function cancel() {
    abortCtrl.current?.abort()
    setStreaming(false)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-3 max-h-64 overflow-auto">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <HoverCopy>
              <div
                className="inline-block p-2 rounded bg-gray-50"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.content) }}
              />
            </HoverCopy>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-2 border rounded"
          rows={3}
        />
        <div className="flex flex-col gap-2">
          <button onClick={send} disabled={streaming} className="px-3 py-1 bg-blue-600 text-white rounded">
            Send
          </button>
          {streaming ? (
            <button onClick={cancel} className="px-3 py-1 bg-red-500 text-white rounded">
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
