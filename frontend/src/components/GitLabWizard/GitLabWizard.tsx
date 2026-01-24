import { useState } from 'react'

type WizardData = {
  url: string
  token: string
  projects: string[]
  user: string
}

export default function GitLabWizard({ onSave }: { onSave?: (data: WizardData) => void }) {
  const [step, setStep] = useState(1)
  const [data, setData] = useState<WizardData>({ url: '', token: '', projects: [], user: '' })

  function next() {
    setStep((s) => Math.min(3, s + 1))
  }
  function prev() {
    setStep((s) => Math.max(1, s - 1))
  }

  function save() {
    onSave?.(data)
    // TODO: call backend to persist
  }

  return (
    <div className="p-4 max-w-xl">
      <div className="mb-3">Step {step} / 3</div>

      {step === 1 && (
        <div className="space-y-2">
          <label className="block">GitLab URL</label>
          <input
            value={data.url}
            onChange={(e) => setData({ ...data, url: e.target.value })}
            className="w-full p-2 border rounded"
            placeholder="https://gitlab.example.com"
          />

          <label className="block">Access Token</label>
          <input
            value={data.token}
            onChange={(e) => setData({ ...data, token: e.target.value })}
            className="w-full p-2 border rounded"
            placeholder="glpat-..."
          />
          <div className="text-sm text-gray-500">先設定連線資訊，才能取得專案列表</div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <label className="block">要加入的專案 (每行一個 project ID 或 path)</label>
          <textarea
            value={data.projects.join('\n')}
            onChange={(e) => setData({ ...data, projects: e.target.value.split(/\r?\n/).filter(Boolean) })}
            className="w-full p-2 border rounded"
            rows={4}
            placeholder="123\nmygroup/myproject"
          />
          <div className="text-sm text-gray-500">可以在上一頁連線成功後由後端回傳選單，這裡允許手動貼上。</div>
          {data.projects.length === 0 && (
            <div className="text-sm text-warning mt-1">請先選擇或貼上至少一個專案，才能前往下一步選擇使用者。</div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <label className="block">使用者識別 (email 或 user id)</label>
          <input
            value={data.user}
            onChange={(e) => setData({ ...data, user: e.target.value })}
            className="w-full p-2 border rounded"
            placeholder="user@example.com"
          />
        </div>
      )}

      {/* 第三步為選擇使用者並可直接儲存設定 */}

      <div className="mt-4 flex gap-2">
        {step > 1 && (
          <button onClick={prev} className="px-3 py-1 border rounded">
            上一步
          </button>
        )}
        {step < 4 && (
          <button
            onClick={next}
            className="px-3 py-1 bg-blue-600 text-white rounded"
            disabled={step === 2 && data.projects.length === 0}
          >
            下一步
          </button>
        )}
        {step === 3 && (
          <button onClick={save} className="px-3 py-1 bg-green-600 text-white rounded">
            儲存設定
          </button>
        )}
      </div>
    </div>
  )
}
