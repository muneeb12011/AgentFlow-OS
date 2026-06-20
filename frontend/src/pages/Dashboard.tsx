import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Square, Plus, Trash2, LogOut, MessageSquare,
  Wifi, WifiOff, Activity, Menu, Sparkles, ChevronRight,
  Bot, User as UserIcon, X, Settings,
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
  { node: "supervisor", content: "Breaking down your goal into subtasks:\n1. Research the topic thoroughly\n2. Write and execute code if needed\n3. Synthesise a final polished response" },
  { node: "researcher", content: "Searched Tavily + ArXiv:\n— Gathered key research findings\n— Identified relevant papers and sources\n— Compiled structured information" },
  { node: "coder", content: "Generated Python code and executed in sandbox.\n\n✓ Execution successful. No errors." },
  { node: "critic", content: "Quality score: 0.91 / 1.0 ✓\nAccuracy ✓  Completeness ✓  Code validity ✓\nThreshold cleared — no retry required." },
  { node: "writer", content: "Here is your comprehensive answer based on autonomous research and code execution. The system gathered information, wrote and tested code, reviewed quality, and synthesised this final response — completely without intervention." },
];

interface DashboardProps {
  onSignOut?: () => void;
}

export default function Dashboard({ onSignOut }: DashboardProps) {
  const { user, token, logout } = useAuth();
  const { chats, activeChatId, createChat, addMessage, setActiveChat, deleteChat, getUserChats } = useHistory();

  const [goal, setGoal] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeNode, setActiveNode] = useState("");
  const [done, setDone] = useState(new Set<string>());
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const streamingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const userChats = user ? getUserChats(user.user_id) : [];
  const activeChat = chats.find((c) => c.id === activeChatId);
  const msgs = activeChat?.messages || [];

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, streaming]);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.ok ? setConnected(true) : setConnected(false))
      .catch(() => setConnected(false));
  }, []);

  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });
  const addMsg = (chatId: string, msg: Message) => addMessage(chatId, msg);

  const handleSignOut = () => {
    if (streaming) stop();
    logout();
    if (onSignOut) onSignOut();
  };

  const stop = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    streamingRef.current = false;
    setStreaming(false);
    setActiveNode("");
    if (activeChatId) addMsg(activeChatId, { role: "agent", content: "Run stopped.", node: "system", ts: now() });
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
      addMsg(chatId, { role: "agent", content: "Connection error. Please try again.", node: "system", ts: now() });
    });
  };

  const runDemo = async (chatId: string) => {
    setStreaming(true);
    streamingRef.current = true;
    setDone(new Set());
    for (const d of DEMO_STEPS) {
      if (!streamingRef.current) break;
      setActiveNode(d.node);
      await new Promise((r) => setTimeout(r, 1400));
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
    const chatId = activeChatId || createChat(user.user_id, text);
    if (!activeChatId) setActiveChat(chatId);
    addMsg(chatId, { role: "user", content: text, ts: now() });
    if (connected && token && !token.startsWith("demo-")) {
      runReal(chatId, text);
    } else {
      runDemo(chatId);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const newChat = () => {
    setActiveChat(null);
    setDone(new Set());
    if (streaming) stop();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const avatarLetter = (user?.name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#060606] flex overflow-hidden">

      {/* ── Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed md:relative z-30 top-0 left-0 h-full w-[260px] flex-shrink-0 bg-[#0A0A0A] border-r border-white/[0.06] flex flex-col"
          >
            {/* Logo */}
            <div className="px-4 pt-5 pb-4 border-b border-white/[0.05]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                    <span className="font-mono text-[10px] font-bold text-white">AF</span>
                  </div>
                  <div>
                    <div className="font-display font-bold text-[13px] text-white">AgentFlow</div>
                    <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">Multi-agent OS</div>
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden text-white/30 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={newChat}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white text-black font-mono text-[10px] uppercase tracking-[0.12em] font-semibold hover:bg-white/90 transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-3.5 h-3.5" /> New Chat
              </button>
            </div>

            {/* Chat history */}
            <div className="flex-1 overflow-y-auto py-3 px-2">
              {userChats.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-4 h-4 text-white/15" />
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/20">No conversations yet</div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {userChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => setActiveChat(chat.id)}
                      className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                        activeChatId === chat.id
                          ? "bg-white/[0.07] border border-white/[0.08]"
                          : "hover:bg-white/[0.04] border border-transparent"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-body text-[12.5px] text-white/65 truncate leading-tight">{chat.title}</div>
                        <div className="font-mono text-[9px] text-white/20 mt-0.5">{new Date(chat.updatedAt).toLocaleDateString()}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User + signout */}
            <div className="p-3 border-t border-white/[0.05]">
              {/* Status */}
              <div className="flex items-center gap-2 px-3 py-2 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400" : "bg-yellow-400"}`} style={{ boxShadow: connected ? "0 0 6px #34d399" : "none" }} />
                <span className={`font-mono text-[9px] uppercase tracking-[0.12em] ${connected ? "text-emerald-300" : "text-yellow-300"}`}>
                  {connected ? "Live agents" : "Demo mode"}
                </span>
              </div>

              {/* User info */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] mb-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-mono text-[10px] font-bold text-white">{avatarLetter}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-[12px] text-white/75 truncate font-medium">{user?.name || "User"}</div>
                  <div className="font-mono text-[9px] text-white/30 truncate">{user?.email}</div>
                </div>
              </div>

              {/* Sign out */}
              {showSignOutConfirm ? (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/20">
                  <div className="font-body text-[11px] text-white/60 mb-2">Sign out?</div>
                  <div className="flex gap-2">
                    <button onClick={handleSignOut} className="flex-1 py-1.5 rounded-md bg-red-500/20 border border-red-500/30 font-mono text-[9px] uppercase tracking-[0.08em] text-red-300 hover:bg-red-500/30 transition">
                      Yes, sign out
                    </button>
                    <button onClick={() => setShowSignOutConfirm(false)} className="flex-1 py-1.5 rounded-md border border-white/[0.08] font-mono text-[9px] uppercase tracking-[0.08em] text-white/40 hover:text-white transition">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-transparent hover:bg-red-500/[0.07] hover:border-red-500/15 transition-all font-mono text-[10px] uppercase tracking-[0.1em] text-white/30 hover:text-red-300"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.05] bg-[#060606]/80 backdrop-blur-sm flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white/35 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/[0.05]">
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <span className="font-mono text-[11px] text-white/35 truncate">
              {activeChat ? activeChat.title : "New conversation"}
            </span>
          </div>

          {/* Pipeline pills */}
          <div className="hidden lg:flex items-center gap-1">
            {PIPE.map((n) => {
              const isA = activeNode === n;
              const isD = done.has(n);
              const c = AGENT_COLORS[n];
              return (
                <div
                  key={n}
                  className="flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200"
                  style={{
                    background: isA ? c + "18" : "transparent",
                    border: `1px solid ${isA ? c + "50" : isD ? c + "20" : "transparent"}`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                    style={{
                      background: isA ? c : isD ? c + "70" : "rgba(255,255,255,.1)",
                      boxShadow: isA ? `0 0 6px ${c}` : "none",
                    }}
                  />
                  <span className="font-mono text-[8px] uppercase tracking-[0.06em] transition-colors duration-200" style={{ color: isA ? c : isD ? c + "aa" : "rgba(255,255,255,.18)" }}>
                    {n}
                  </span>
                  {isA && <span className="text-[8px] animate-spin" style={{ color: c }}>◌</span>}
                  {isD && !isA && <span className="text-[8px] text-emerald-400">✓</span>}
                </div>
              );
            })}
          </div>

          {streaming && (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20 transition"
            >
              <Square className="w-2.5 h-2.5 fill-current" /> Stop
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={msgsRef} className="flex-1 overflow-y-auto">
          {msgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-full px-6 py-16">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-xl text-center space-y-8">
                <div>
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10" />
                    <div className="absolute inset-0 rounded-2xl flex items-center justify-center">
                      <Activity className="w-7 h-7 text-cyan-300" />
                    </div>
                    {connected && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#060606]" style={{ boxShadow: "0 0 8px #34d399" }} />
                    )}
                  </div>
                  <h2 className="font-display font-bold text-[22px] text-white mb-2 tracking-tight">
                    Hey {user?.name?.split(" ")[0] || "there"} 👋
                  </h2>
                  <p className="font-body text-white/40 text-[14px] leading-relaxed">
                    {connected
                      ? "Six agents are live and ready. Give them a goal."
                      : "Running in demo mode. Type a goal to see a simulation."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
                      onClick={() => send(s)}
                      className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all text-left group"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400/60 flex-shrink-0 mt-0.5 group-hover:text-cyan-300 transition-colors" />
                      <span className="font-body text-[12.5px] text-white/45 group-hover:text-white/70 transition-colors leading-snug">{s}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              <AnimatePresence initial={false}>
                {msgs.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 mt-1">
                      {m.role === "user" ? (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-white/10 flex items-center justify-center">
                          <span className="font-mono text-[9px] font-bold text-white">{avatarLetter}</span>
                        </div>
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full border flex items-center justify-center"
                          style={{
                            background: m.node && m.node !== "system" ? (AGENT_COLORS[m.node] || "#94A3B8") + "18" : "rgba(255,255,255,.04)",
                            borderColor: m.node && m.node !== "system" ? (AGENT_COLORS[m.node] || "#94A3B8") + "40" : "rgba(255,255,255,.08)",
                          }}
                        >
                          <Bot className="w-3.5 h-3.5" style={{ color: m.node && m.node !== "system" ? AGENT_COLORS[m.node] || "#94A3B8" : "#94A3B8" }} />
                        </div>
                      )}
                    </div>

                    {/* Bubble */}
                    <div className={`flex-1 max-w-[85%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      {/* Label */}
                      <div className={`flex items-center gap-1.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        {m.role === "user" ? (
                          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/25">{user?.name?.split(" ")[0] || "You"}</span>
                        ) : m.node && m.node !== "system" ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: AGENT_COLORS[m.node] || "#94A3B8" }} />
                            <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: AGENT_COLORS[m.node] || "#94A3B8" }}>{m.node}</span>
                          </>
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-white/20">system</span>
                        )}
                        {m.ts && <span className="font-mono text-[9px] text-white/15">{m.ts}</span>}
                      </div>

                      {/* Content */}
                      <div
                        className="px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap break-words"
                        style={
                          m.role === "user"
                            ? { background: "rgba(6,182,212,.1)", border: "1px solid rgba(6,182,212,.2)", color: "rgba(255,255,255,.9)", fontFamily: "var(--font-body, sans-serif)", borderRadius: "18px 4px 18px 18px" }
                            : m.node === "system"
                            ? { background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.05)", color: "rgba(255,255,255,.4)", fontFamily: "monospace", fontSize: "12px", borderRadius: "4px 18px 18px 18px" }
                            : { background: "#0E0E0E", border: `1px solid ${(AGENT_COLORS[m.node || ""] || "#94A3B8") + "20"}`, color: "rgba(255,255,255,.75)", fontFamily: "monospace", fontSize: "12.5px", borderRadius: "4px 18px 18px 18px" }
                        }
                      >
                        {m.content}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {streaming && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background: activeNode ? (AGENT_COLORS[activeNode] || "#94A3B8") + "18" : "rgba(255,255,255,.04)", borderColor: activeNode ? (AGENT_COLORS[activeNode] || "#94A3B8") + "40" : "rgba(255,255,255,.08)" }}
                  >
                    <Bot className="w-3.5 h-3.5" style={{ color: activeNode ? AGENT_COLORS[activeNode] || "#94A3B8" : "#94A3B8" }} />
                  </div>
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#0E0E0E] border border-white/[0.06]" style={{ borderRadius: "4px 18px 18px 18px" }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: activeNode ? AGENT_COLORS[activeNode] || "#94A3B8" : "#94A3B8" }}
                          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                        />
                      ))}
                    </div>
                    <span className="font-mono text-[11px] text-white/35">
                      {activeNode ? `${activeNode} is working…` : "Processing…"}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-white/[0.05] bg-[#060606]/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder={connected ? "Give the agents a goal…" : "Type a goal… (demo mode)"}
                  disabled={streaming}
                  className="w-full bg-[#0E0E0E] border border-white/[0.09] rounded-2xl px-5 py-3.5 text-white text-[14px] font-body outline-none focus:border-cyan-400/35 focus:bg-[#111] transition-all disabled:opacity-50 placeholder:text-white/20 pr-4"
                />
              </div>
              <button
                onClick={() => send()}
                disabled={!goal.trim() || streaming}
                className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center disabled:opacity-25 hover:bg-white/90 hover:scale-105 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {!connected && (
              <p className="font-mono text-[9px] text-yellow-400/40 text-center mt-2 uppercase tracking-[0.1em]">
                Demo mode — connect to live backend for real agents
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}