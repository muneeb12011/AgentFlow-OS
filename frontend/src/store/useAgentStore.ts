import { create } from 'zustand'

export type AgentStatus = 'idle' | 'planning' | 'running' | 'reviewing' | 'done' | 'failed'
export type WorkerType  = 'supervisor' | 'researcher' | 'coder' | 'analyst' | 'critic' | 'writer'

export interface NodeUpdate {
  node:       WorkerType
  status:     string
  updated_at: string
  messages:   { content: string; type: string }[]
  token_usage?: TokenUsage
}

export interface ToolCall {
  id:        string
  tool_name: string
  input:     Record<string, unknown>
  output:    string | null
  error:     string | null
  started_at:string
}

export interface TokenUsage {
  prompt_tokens:      number
  completion_tokens:  number
  total_tokens:       number
  estimated_cost_usd: number
}

export interface RunResult {
  run_id:      string
  status:      AgentStatus
  answer:      string | null
  token_usage: TokenUsage
  duration_ms: number
  errors:      string[]
}

interface AgentStore {
  // Auth
  token:     string | null
  setToken:  (t: string) => void

  // Run state
  goal:         string
  setGoal:      (g: string) => void
  status:       AgentStatus
  activeNode:   WorkerType | null
  nodeHistory:  NodeUpdate[]
  toolCalls:    ToolCall[]
  messages:     { content: string; role: 'user' | 'agent'; node?: string }[]
  tokenUsage:   TokenUsage
  result:       RunResult | null
  isStreaming:  boolean

  // Actions
  startRun:    (goal: string) => Promise<void>
  reset:       () => void
  addMessage:  (m: { content: string; role: 'user' | 'agent'; node?: string }) => void
}

const DEFAULT_USAGE: TokenUsage = {
  prompt_tokens: 0, completion_tokens: 0,
  total_tokens: 0, estimated_cost_usd: 0,
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  token:    localStorage.getItem('agentflow_token'),
  setToken: (t) => { localStorage.setItem('agentflow_token', t); set({ token: t }) },

  goal:        '',
  setGoal:     (g) => set({ goal: g }),
  status:      'idle',
  activeNode:  null,
  nodeHistory: [],
  toolCalls:   [],
  messages:    [],
  tokenUsage:  DEFAULT_USAGE,
  result:      null,
  isStreaming: false,

  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),

  reset: () => set({
    status: 'idle', activeNode: null, nodeHistory: [],
    toolCalls: [], result: null, isStreaming: false,
    tokenUsage: DEFAULT_USAGE,
  }),

  startRun: async (goal: string) => {
    const { token } = get()
    if (!token) return

    get().reset()
    set({ goal, isStreaming: true, status: 'planning' })
    get().addMessage({ content: goal, role: 'user' })

    const url = `/api/runs/stream?goal=${encodeURIComponent(goal)}`

    const es = new EventSource(url + `&token=${token}`)

    // Patch: attach auth header via fetch+ReadableStream for production
    // For dev, we pass token as query param
    es.addEventListener('node_update', (e) => {
      const data: NodeUpdate = JSON.parse(e.data)
      set((s) => ({
        activeNode:  data.node,
        nodeHistory: [...s.nodeHistory, data],
        status:      (data.status as AgentStatus) || s.status,
        tokenUsage:  data.token_usage || s.tokenUsage,
      }))
      for (const msg of data.messages || []) {
        if (msg.content) {
          get().addMessage({ content: msg.content, role: 'agent', node: data.node })
        }
      }
    })

    es.addEventListener('run_complete', (e) => {
      const data: RunResult = JSON.parse(e.data)
      set({
        result:      data,
        status:      data.status || 'done',
        isStreaming: false,
        activeNode:  null,
        tokenUsage:  data.token_usage || get().tokenUsage,
      })
      if (data.answer) {
        get().addMessage({ content: data.answer, role: 'agent', node: 'writer' })
      }
      es.close()
    })

    es.addEventListener('error', () => {
      set({ isStreaming: false, status: 'failed' })
      es.close()
    })
  },
}))
