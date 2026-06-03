import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Square, Maximize2, Minimize2, X, Plus, Trash2,
  LogOut, ChevronRight, MessageSquare, Wifi, WifiOff,
  RotateCcw, Activity, Menu, Sparkles,
} from "lucide-react";
import { useAuth } from "../store/useAuth";
import { useHistory, Message } from "../store/useHistory";

const API_URL = import.meta.env.VITE_API_URL || "https://muneeb01x-agentflow-os.hf.space";

const AGENT_COLORS: Record<string, string> = {
  supervisor: "#FACC15",
  researcher: "#3B82F6",
  coder: "#22C55E",
  analyst: "#F97316",
  critic: "#EF4444",
  writer: "#06B6D4",
  system: "#94A3B8",
};

const PIPE = ["supervisor", "researcher", "coder", "analyst", "critic", "writer"];

const SUGGESTIONS = [
  "Research what LangGraph is and write a Python example",
  "Write a Python calculator and test it",
  "Explain how transformer attention works",
  "Write a Python web scraper for news headlines",
];

const DEMO_STEPS = [
  { node: "supervisor", content: "Breaking down goal:\n1. Research the topic\n2. Write code if needed\n3. Synthesise final response" },
  { node: "researcher", content: "Searched Tavily + ArXiv:\n— Found relevant research papers\n— Gathered key information\n— Compiled findings" },
  { node: "coder", content: "Generated and executed Python code.\n✓ No errors." },
  { node: "critic", content: "Quality score: 0.91 ✓\nAccuracy ✓  Completeness ✓\nNo retry required." },
  { node: "writer", content: "Here is your comprehensive answer based on research and code execution. The system has autonomously gathered information, written and tested code, reviewed quality, and synthesised this final response." },
];

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const { chats, activeChatId, createChat, addMessage, setActiveChat, deleteChat, getUserChats } = useHistory();

  const [goal, setGoal] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeNode, setActiveNode] = useState("");
  const [done, setDone] = useState(new Set<string>());
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const streamingRef = useRef(false);

  const userChats = user ? getUserChats(user.user_id) : [];
  const activeChat = chats.find((c) => c.id === activeChatId);
  const msgs = activeChat?.messages || [];

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, streaming]);

  // Test backend connection on mount
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.ok ? setConnected(true) : setConnected(false))
      .catch(() => setConnected(false));
  }, []);

  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });

  const addMsg = (chatId: string, msg: Message) => addMessage(chatId, msg);

  const stop = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    streamingRef.current = false;
    setStreaming(false);
    setActiveNode("");
    if (activeChatId) addMsg(activeChatId, { role: "agent", content: "⚠ Run stopped by user.", node: "system", ts: now() });
  };

  const runReal = (chatId: string, g: string) => {
    setStreaming(true);
    streamingRef.current = true;
    setDone(new Set());

    const es = new EventSource(`${API_URL}/api/runs/stream?goal=${encodeURIComponent(g)}&token=${token}`);
    esRef.current = es;

    es.addEventListener("node_update", (e) => {
      const data = JSON.parse(e.data);
      setActiveNode(data.node);
      setDone((p) => new Set([...p, data.node]));
      const content = data.messages?.[0]?.content || data.status || "";
      if (content) addMsg(chatId, { role: "agent", content, node: data.node, ts: now() });
    });

    es.addEventListener("run_complete", (e) => {
      const data = JSON.parse(e.data);
      if (data.answer) addMsg(chatId, { role: "agent", content: data.answer, node: "writer", ts: now() });
      streamingRef.current = false;
      setStreaming(false);
      setActiveNode("");
      es.close();
      esRef.current = null;
    });

    es.addEventListener("error", () => {
      es.close();
      esRef.current = null;
      streamingRef.current = false;
      setStreaming(false);
      setActiveNode("");
      addMsg(chatId, { role: "agent", content: "⚠ Connection error. Please try again.", node: "system", ts: now() });
    });
  };

  const runDemo = async (chatId: string) => {
    setStreaming(true);
    streamingRef.current = true;
    setDone(new Set());

    for (const d of DEMO_STEPS) {
      if (!streamingRef.current) break;
      setActiveNode(d.node);
      await new Promise((r) => setTimeout(r, 1200));
      if (!streamingRef.current) break;
      addMsg(chatId, { role: "agent", content: d.content, node: d.node, ts: now() });
      setDone((p) => new Set([...p, d.node]));
      setActiveNode("");
    }

    streamingRef.current = false;
    setStreaming(false);
  };

  const send = (g?: string) => {
    const text = (g ?? goal).trim();
    if (!text || streaming || !user) return;
    setGoal("");

    // Create new chat or use active
    const chatId = activeChatId || createChat(user.user_id, text);
    if (!activeChatId) setActiveChat(chatId);

    addMsg(chatId, { role: "user", content: text, ts: now() });

    if (connected && token && !token.startsWith("demo-")) {
      runReal(chatId, text);
    } else {
      runDemo(chatId);
    }
  };

  const newChat = () => {
    setActiveChat(null);
    setDone(new Set());
    if (streaming) stop();
  };

  return (
    <div className={`${fullscreen ? "fixed inset-0 z-[100]" : "min-h-screen"} bg-[#050505] flex`}>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-shrink-0 border-r border-white/[0.06] bg-[#080808] flex flex-col overflow-hidden"
          >
            {/* Sidebar header */}
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="relative font-mono text-[9px] font-bold text-white">AF</span>
                </div>
                <div className="min-w-0">
                  <div className="font-display font-bold text-[13px] text-white truncate">AgentFlow OS</div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/35 truncate">{user?.email}</div>
                </div>
              </div>
              <button
                onClick={newChat}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 transition-all font-mono text-[10px] uppercase tracking-[0.1em] text-white/60 hover:text-white"
              >
                <Plus className="w-3.5 h-3.5" /> New Chat
              </button>
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto py-2">
              {userChats.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <div className="font-mono text-[10px] text-white/25">No chats yet</div>
                </div>
              ) : (
                userChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => setActiveChat(chat.id)}
                    className={`group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all ${activeChatId === chat.id ? "bg-white/[0.06] border border-white/[0.08]" : "hover:bg-white/[0.03]"}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-[12px] text-white/70 truncate">{chat.title}</div>
                      <div className="font-mono text-[9px] text-white/25">{new Date(chat.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                      className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Sidebar footer */}
            <div className="p-3 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5">
                {connected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-white/30" />}
                <span className={`font-mono text-[9px] uppercase tracking-[0.12em] ${connected ? "text-emerald-300" : "text-yellow-300"}`}>
                </span>
              </div>
              <button
                onClick={() => { logout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/[0.08] hover:border-red-500/20 border border-transparent transition-all font-mono text-[10px] uppercase tracking-[0.1em] text-white/40 hover:text-red-300"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-black/40 backdrop-blur-sm">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white/40 hover:text-white transition-colors">
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] text-white/50 truncate">
              {activeChat ? activeChat.title : "New conversation"}
            </div>
          </div>

          {/* Pipeline indicator */}
          <div className="hidden md:flex items-center gap-1.5">
            {PIPE.map((n) => {
              const isA = activeNode === n;
              const isD = done.has(n);
              const c = AGENT_COLORS[n];
              return (
                <div key={n} className="flex items-center gap-1 px-2 py-1 rounded-md border transition-all" style={{ borderColor: isA ? c + "55" : isD ? c + "25" : "transparent", background: isA ? c + "15" : "transparent" }}>
                  <span className="w-1.5 h-1.5 rounded-full transition-all" style={{ background: isA ? c : isD ? c + "80" : "rgba(255,255,255,.1)", boxShadow: isA ? `0 0 6px ${c}` : "none" }} />
                  <span className="font-mono text-[8px] uppercase" style={{ color: isA ? c : isD ? c + "cc" : "rgba(255,255,255,.2)" }}>{n}</span>
                  {isA && <span className="text-[8px] animate-spin" style={{ color: c }}>◌</span>}
                  {isD && !isA && <span className="text-[8px] text-emerald-400">✓</span>}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {streaming && (
              <button onClick={stop} className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition">
                <Square className="w-2.5 h-2.5 fill-current" /> Stop
              </button>
            )}
            <button onClick={() => setFullscreen(!fullscreen)} className="text-white/40 hover:text-white transition-colors">
              {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={msgsRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {msgs.length === 0 && (
            <div className="max-w-2xl mx-auto py-16 text-center space-y-8">
              <div>
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-7 h-7 text-cyan-300" />
                </div>
                <h2 className="font-display font-bold text-2xl text-white mb-2">
                  Welcome back, {user?.name || user?.email?.split("@")[0]}!
                </h2>
                <p className="font-body text-white/40 text-sm">
                  {connected ? "Live agents ready. Type a goal to start." : "Demo mode active. Type a goal to see a simulation."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all text-left group"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5 group-hover:text-cyan-300" />
                    <span className="font-body text-[13px] text-white/55 group-hover:text-white/80 transition-colors">{s}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`max-w-3xl ${m.role === "user" ? "ml-auto" : "mr-auto"} w-full`}
              >
                <div
                  className="rounded-xl px-4 py-3 border"
                  style={{
                    background: m.role === "user" ? "rgba(6,182,212,.08)" : m.node === "system" ? "rgba(255,255,255,.02)" : "#0A0A0A",
                    borderColor: m.role === "user" ? "rgba(6,182,212,.25)" : m.node === "system" ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.07)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    {m.role === "user" && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-400/80">{user?.name || "You"}</span>}
                    {m.role === "agent" && m.node && m.node !== "system" && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: AGENT_COLORS[m.node] || "#94A3B8" }} />
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: AGENT_COLORS[m.node] || "#94A3B8" }}>{m.node}</span>
                      </div>
                    )}
                    {m.role === "agent" && m.node === "system" && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/25">system</span>}
                    {m.ts && <span className="font-mono text-[9px] text-white/20">{m.ts}</span>}
                  </div>
                  <div className={`${m.role === "user" ? "font-body text-[14px] text-white" : "font-mono text-[12.5px] text-white/75"} leading-relaxed whitespace-pre-wrap break-words`}>
                    {m.content}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {streaming && (
            <div className="flex items-center gap-3 max-w-3xl px-4 py-3 rounded-xl border border-white/[0.06] bg-[#0A0A0A]">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.5, delay: i * 0.12, repeat: Infinity }} />
                ))}
              </div>
              <span className="font-mono text-[11px] text-white/40">{activeNode ? `${activeNode} agent is working…` : "Processing your goal…"}</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-black/30">
          <div className="max-w-3xl mx-auto space-y-2">
            <div className="flex gap-3">
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder={connected ? "Type a goal for the agents…" : "Type a goal… (demo mode)"}
                disabled={streaming}
                className="flex-1 bg-[#0A0A0A] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-[14px] font-body outline-none focus:border-cyan-400/40 transition disabled:opacity-60 placeholder:text-white/25"
              />
              <button
                onClick={() => send()}
                disabled={!goal.trim() || streaming}
                className="flex-shrink-0 w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center disabled:opacity-30 hover:scale-105 hover:bg-white/90 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {!connected && (
              <div className="font-mono text-[9px] text-yellow-400/50 text-center">⚠ Demo mode — connect to live backend for real agents</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}