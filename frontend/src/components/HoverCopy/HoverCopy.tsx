import React, { useRef, useState } from 'react'

export default function HoverCopy({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  function copy() {
    const sel = window.getSelection()?.toString()?.trim()
    const text = sel && sel.length > 0 ? sel : ref.current?.innerText || ''
    if (!text) return
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      })
      .catch(() => {})
  }

  return (
    <div
      ref={ref}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {show && (
        <button
          onClick={copy}
          style={{ position: 'absolute', right: -38, top: -6 }}
          title="Copy selection or full"
          className="px-2 py-0.5 text-xs rounded bg-gray-200"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}
      <div>{children}</div>
    </div>
  )
}
