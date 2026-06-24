import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Square, Plus, Trash2, LogOut, MessageSquare,
  Wifi, WifiOff, Menu, Sparkles, Bot, X,
  Sun, Moon, ChevronRight, Zap, Activity,
} from "lucide-react";
import { useAuth } from "../store/useAuth";
import { useHistory, Message } from "../store/useHistory";

const API_URL = import.meta.env.VITE_API_URL || "https://muneeb01x-agentflow-os.hf.space";

const AGENT_META: Record<string, { color: string; bg: string; label: string }> = {
  supervisor: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  label: "Supervisor" },
  researcher: { color: "#3B82F6", bg: "rgba(59,130,246,0.1)",  label: "Researcher" },
  coder:      { color: "#10B981", bg: "rgba(16,185,129,0.1)",  label: "Coder"      },
  analyst:    { color: "#F97316", bg: "rgba(249,115,22,0.1)",  label: "Analyst"    },
  critic:     { color: "#EF4444", bg: "rgba(239,68,68,0.1)",   label: "Critic"     },
  writer:     { color: "#06B6D4", bg: "rgba(6,182,212,0.1)",   label: "Writer"     },
  system:     { color: "#94A3B8", bg: "rgba(148,163,184,0.1)", label: "System"     },
};

const PIPE = ["supervisor", "researcher", "coder", "analyst", "critic", "writer"];

const SUGGESTIONS = [
  { text: "Research what LangGraph is and write a Python example", icon: "🔬" },
  { text: "Write a Python calculator and test it",                 icon: "🧮" },
  { text: "Explain how transformer attention works",               icon: "🧠" },
  { text: "Write a Python web scraper for news headlines",         icon: "🕷️" },
];

const DEMO_STEPS = [
  { node: "supervisor", content: "Breaking down your goal into subtasks:\n1. Research the topic thoroughly\n2. Write and execute code if needed\n3. Synthesise a final polished response" },
  { node: "researcher", content: "Searched Tavily + ArXiv:\n— Gathered key research findings\n— Identified relevant papers and sources\n— Compiled structured information" },
  { node: "coder",      content: "Generated Python code and executed in sandbox.\n\n✓ Execution successful. No errors." },
  { node: "critic",     content: "Quality score: 0.91 / 1.0 ✓\nAccuracy ✓  Completeness ✓  Code validity ✓\nThreshold cleared — no retry required." },
  { node: "writer",     content: "Here is your comprehensive answer based on autonomous research and code execution. The system gathered information, wrote and tested code, reviewed quality, and synthesised this final response — completely without intervention." },
];

interface DashboardProps { onSignOut?: () => void; }

export default function Dashboard({ onSignOut }: DashboardProps) {
  const { user, token, logout } = useAuth();
  const { chats, activeChatId, createChat, addMessage, setActiveChat, deleteChat, getUserChats } = useHistory();

  const [goal, setGoal] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeNode, setActiveNode] = useState("");
  const [done, setDone] = useState(new Set<string>());
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(true);
  const [showSignOut, setShowSignOut] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const streamingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const userChats = user ? getUserChats(user.user_id) : [];
  const activeChat = chats.find((c) => c.id === activeChatId);
  const msgs = activeChat?.messages || [];

  // Theme tokens
  const T = dark ? {
    bg:          "#070708",
    bgPanel:     "#0E0E10",
    bgInput:     "#141416",
    bgHover:     "rgba(255,255,255,0.04)",
    bgActive:    "rgba(255,255,255,0.07)",
    border:      "rgba(255,255,255,0.07)",
    borderLight: "rgba(255,255,255,0.04)",
    text:        "#F1F1F3",
    textMuted:   "rgba(241,241,243,0.45)",
    textFaint:   "rgba(241,241,243,0.22)",
    userBubble:  { bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)", text: "#E0E0FF" },
    sidebarBg:   "#0A0A0C",
  } : {
    bg:          "#F8F8FA",
    bgPanel:     "#FFFFFF",
    bgInput:     "#FFFFFF",
    bgHover:     "rgba(0,0,0,0.04)",
    bgActive:    "rgba(0,0,0,0.07)",
    border:      "rgba(0,0,0,0.08)",
    borderLight: "rgba(0,0,0,0.05)",
    text:        "#111113",
    textMuted:   "rgba(17,17,19,0.5)",
    textFaint:   "rgba(17,17,19,0.28)",
    userBubble:  { bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.2)", text: "#3730A3" },
    sidebarBg:   "#FFFFFF",
  };

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, streaming]);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.ok ? setConnected(true) : setConnected(false))
      .catch(() => setConnected(false));
  }, []);

  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
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
      streamingRef.current = false; setStreaming(false); setActiveNode("");
      es.close(); esRef.current = null;
    });
    es.addEventListener("error", () => {
      es.close(); esRef.current = null;
      streamingRef.current = false; setStreaming(false); setActiveNode("");
      addMsg(chatId, { role: "agent", content: "Connection error. Please try again.", node: "system", ts: now() });
    });
  };

  const runDemo = async (chatId: string) => {
    setStreaming(true); streamingRef.current = true; setDone(new Set());
    for (const d of DEMO_STEPS) {
      if (!streamingRef.current) break;
      setActiveNode(d.node);
      await new Promise((r) => setTimeout(r, 1400));
      if (!streamingRef.current) break;
      addMsg(chatId, { role: "agent", content: d.content, node: d.node, ts: now() });
      setDone((p) => new Set([...p, d.node]));
      setActiveNode("");
    }
    streamingRef.current = false; setStreaming(false);
  };

  const send = (g?: string) => {
    const text = (g ?? goal).trim();
    if (!text || streaming || !user) return;
    setGoal("");
    const chatId = activeChatId || createChat(user.user_id, text);
    if (!activeChatId) setActiveChat(chatId);
    addMsg(chatId, { role: "user", content: text, ts: now() });
    if (connected && token && !token.startsWith("demo-")) runReal(chatId, text);
    else runDemo(chatId);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const newChat = () => {
    setActiveChat(null); setDone(new Set());
    if (streaming) stop();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const avatarLetter = (user?.name || user?.email || "U")[0].toUpperCase();
  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", fontFamily: "system-ui, -apple-system, sans-serif", transition: "background 0.2s, color 0.2s" }}>

      {/* ── Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Mobile overlay */}
            <motion.div
              className="md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "fixed", top: 0, left: 0, bottom: 0, width: 260, zIndex: 30,
                background: T.sidebarBg, borderRight: `1px solid ${T.border}`,
                display: "flex", flexDirection: "column",
              }}
              className="md:relative md:z-auto"
            >
              {/* Logo row */}
              <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${T.borderLight}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #6366F1, #06B6D4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#fff" }}>AF</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.3 }}>AgentFlow</div>
                      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 1 }}>Multi-agent OS</div>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="md:hidden" style={{ color: T.textFaint, padding: 4, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer" }}>
                    <X size={16} />
                  </button>
                </div>
                <button
                  onClick={newChat}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 10, background: dark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)", border: `1px solid rgba(99,102,241,0.25)`, color: "#6366F1", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = dark ? "rgba(99,102,241,0.22)" : "rgba(99,102,241,0.14)")}
                  onMouseLeave={e => (e.currentTarget.style.background = dark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)")}
                >
                  <Plus size={14} /> New conversation
                </button>
              </div>

              {/* Chat list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
                {userChats.length === 0 ? (
                  <div style={{ padding: "40px 16px", textAlign: "center" }}>
                    <MessageSquare size={28} style={{ color: T.textFaint, margin: "0 auto 10px" }} />
                    <div style={{ fontSize: 12, color: T.textFaint }}>No conversations yet</div>
                    <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, opacity: 0.7 }}>Start by typing a goal below</div>
                  </div>
                ) : (
                  userChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => setActiveChat(chat.id)}
                      className="group"
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, cursor: "pointer",
                        background: activeChatId === chat.id ? T.bgActive : "transparent",
                        border: `1px solid ${activeChatId === chat.id ? T.border : "transparent"}`,
                        marginBottom: 2, transition: "all 0.12s",
                      }}
                      onMouseEnter={e => { if (activeChatId !== chat.id) e.currentTarget.style.background = T.bgHover; }}
                      onMouseLeave={e => { if (activeChatId !== chat.id) e.currentTarget.style.background = "transparent"; }}
                    >
                      <MessageSquare size={13} style={{ color: T.textFaint, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: activeChatId === chat.id ? 500 : 400 }}>{chat.title}</div>
                        <div style={{ fontSize: 10, color: T.textFaint, marginTop: 2 }}>{new Date(chat.updatedAt).toLocaleDateString()}</div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                        style={{ opacity: 0, padding: 4, borderRadius: 5, background: "transparent", border: "none", cursor: "pointer", color: "#EF4444", transition: "opacity 0.12s" }}
                        className="group-hover:opacity-100"
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 10px 14px", borderTop: `1px solid ${T.borderLight}` }}>
                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginBottom: 6 }}>
                  {connected
                    ? <><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981", flexShrink: 0 }} /><span style={{ fontSize: 11, color: "#10B981", fontWeight: 500 }}>Live agents connected</span></>
                    : <><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} /><span style={{ fontSize: 11, color: "#F59E0B" }}>Demo mode</span></>
                  }
                </div>

                {/* User card */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 10, background: T.bgHover, marginBottom: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{avatarLetter}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || firstName}</div>
                    <div style={{ fontSize: 10, color: T.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
                  </div>
                </div>

                {/* Sign out */}
                {showSignOut ? (
                  <div style={{ padding: "10px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>Sign out of AgentFlow?</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={handleSignOut} style={{ flex: 1, padding: "7px 0", borderRadius: 7, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Sign out</button>
                      <button onClick={() => setShowSignOut(false)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, background: T.bgHover, border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSignOut(true)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: "transparent", border: "none", color: T.textFaint, fontSize: 12, cursor: "pointer", transition: "all 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.07)"; e.currentTarget.style.color = "#EF4444"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textFaint; }}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", marginLeft: sidebarOpen ? 0 : 0 }} className={sidebarOpen ? "md:ml-[260px]" : ""}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 56, borderBottom: `1px solid ${T.border}`, background: T.bg, flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ padding: 7, borderRadius: 8, background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", transition: "all 0.12s", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <Menu size={17} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeChat ? activeChat.title : "New conversation"}
            </span>
          </div>

          {/* Pipeline status — desktop only */}
          <div className="hidden lg:flex" style={{ alignItems: "center", gap: 4 }}>
            {PIPE.map((n) => {
              const isA = activeNode === n;
              const isD = done.has(n);
              const m = AGENT_META[n];
              return (
                <div
                  key={n}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6,
                    background: isA ? m.bg : "transparent",
                    border: `1px solid ${isA ? m.color + "40" : isD ? m.color + "20" : "transparent"}`,
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: isA ? m.color : isD ? m.color + "80" : T.textFaint, boxShadow: isA ? `0 0 6px ${m.color}` : "none", transition: "all 0.2s" }} />
                  <span style={{ fontSize: 10, fontWeight: 500, color: isA ? m.color : isD ? m.color + "cc" : T.textFaint, transition: "color 0.2s" }}>{n}</span>
                  {isA && <span style={{ fontSize: 9, color: m.color, animation: "spin 1s linear infinite" }}>◌</span>}
                  {isD && !isA && <span style={{ fontSize: 9, color: "#10B981" }}>✓</span>}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {streaming && (
              <button
                onClick={stop}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                <Square size={11} fill="currentColor" /> Stop
              </button>
            )}
            <button
              onClick={() => setDark(!dark)}
              style={{ padding: 7, borderRadius: 8, background: T.bgHover, border: `1px solid ${T.border}`, color: T.textMuted, cursor: "pointer", transition: "all 0.15s" }}
            >
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={msgsRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
          {msgs.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 130px)", padding: "40px 0" }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: "100%", maxWidth: 560, textAlign: "center" }}>
                {/* Status icon */}
                <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 24px" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.2))", border: `1px solid rgba(99,102,241,0.2)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Activity size={28} color="#6366F1" />
                  </div>
                  {connected && (
                    <span style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: "#10B981", border: `2px solid ${T.bg}`, boxShadow: "0 0 8px #10B981" }} />
                  )}
                </div>

                <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: -0.5 }}>
                  Good to see you, {firstName}
                </h2>
                <p style={{ fontSize: 14, color: T.textMuted, marginBottom: 36, lineHeight: 1.6 }}>
                  {connected
                    ? "Six specialized agents are live and ready. Describe what you want to accomplish."
                    : "Running in demo mode. Type any goal to see how the agents work."}
                </p>

                {/* Agent pills */}
                <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginBottom: 36 }}>
                  {PIPE.map((n) => {
                    const m = AGENT_META[n];
                    return (
                      <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 20, background: m.bg, border: `1px solid ${m.color}25`, fontSize: 11, fontWeight: 500, color: m.color }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color }} />
                        {m.label}
                      </span>
                    );
                  })}
                </div>

                {/* Suggestions */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s.text}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                      onClick={() => send(s.text)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 14px",
                        borderRadius: 12, background: T.bgPanel, border: `1px solid ${T.border}`,
                        color: T.textMuted, fontSize: 13, textAlign: "left", cursor: "pointer",
                        transition: "all 0.15s", lineHeight: 1.45,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = T.bgHover; e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)"; e.currentTarget.style.color = T.text; }}
                      onMouseLeave={e => { e.currentTarget.style.background = T.bgPanel; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                      <span>{s.text}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 0 16px" }}>
              <AnimatePresence initial={false}>
                {msgs.map((m, i) => {
                  const isUser = m.role === "user";
                  const meta = m.node ? AGENT_META[m.node] : AGENT_META.system;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "flex", gap: 12, marginBottom: 20, flexDirection: isUser ? "row-reverse" : "row" }}
                    >
                      {/* Avatar */}
                      <div style={{ flexShrink: 0, marginTop: 4 }}>
                        {isUser ? (
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #6366F1, #06B6D4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{avatarLetter}</span>
                          </div>
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: meta.bg, border: `1px solid ${meta.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Bot size={15} color={meta.color} />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, maxWidth: "82%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 5 }}>
                        {/* Label row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: isUser ? "row-reverse" : "row" }}>
                          {isUser ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.textFaint }}>{user?.name?.split(" ")[0] || "You"}</span>
                          ) : m.node && m.node !== "system" ? (
                            <>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{meta.label}</span>
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: T.textFaint }}>System</span>
                          )}
                          {m.ts && <span style={{ fontSize: 10, color: T.textFaint }}>{m.ts}</span>}
                        </div>

                        {/* Bubble */}
                        <div
                          style={isUser ? {
                            padding: "12px 16px", borderRadius: "18px 4px 18px 18px",
                            background: T.userBubble.bg, border: `1px solid ${T.userBubble.border}`,
                            color: T.userBubble.text, fontSize: 14, lineHeight: 1.6,
                          } : m.node === "system" ? {
                            padding: "10px 14px", borderRadius: "4px 18px 18px 18px",
                            background: T.bgHover, border: `1px solid ${T.borderLight}`,
                            color: T.textFaint, fontSize: 12, fontFamily: "monospace", lineHeight: 1.6,
                          } : {
                            padding: "14px 16px", borderRadius: "4px 18px 18px 18px",
                            background: T.bgPanel, border: `1px solid ${T.border}`,
                            color: T.text, fontSize: 13.5, lineHeight: 1.75,
                            fontFamily: m.node === "coder" ? "monospace" : "inherit",
                            boxShadow: dark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.08)",
                          }}
                        >
                          <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.content}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Typing indicator */}
              {streaming && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: activeNode ? AGENT_META[activeNode]?.bg || T.bgHover : T.bgHover, border: `1px solid ${activeNode ? (AGENT_META[activeNode]?.color || T.border) + "30" : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Bot size={15} color={activeNode ? AGENT_META[activeNode]?.color || T.textFaint : T.textFaint} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: "4px 18px 18px 18px", background: T.bgPanel, border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0,1,2].map((i) => (
                        <motion.span
                          key={i}
                          style={{ width: 6, height: 6, borderRadius: "50%", background: activeNode ? AGENT_META[activeNode]?.color || "#6366F1" : "#6366F1", display: "block" }}
                          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      {activeNode ? `${AGENT_META[activeNode]?.label || activeNode} is working…` : "Processing…"}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px 20px", borderTop: `1px solid ${T.border}`, background: T.bg, flexShrink: 0 }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  ref={inputRef}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder={connected ? "Describe a goal for the agents…" : "Type a goal… (demo mode)"}
                  disabled={streaming}
                  style={{
                    width: "100%", padding: "14px 18px", borderRadius: 14,
                    background: T.bgInput, border: `1px solid ${T.border}`,
                    color: T.text, fontSize: 14, outline: "none",
                    transition: "border-color 0.15s",
                    boxSizing: "border-box",
                    boxShadow: dark ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.5)")}
                  onBlur={e => (e.target.style.borderColor = T.border)}
                />
              </div>
              <button
                onClick={() => send()}
                disabled={!goal.trim() || streaming}
                style={{
                  width: 48, height: 48, borderRadius: 13, flexShrink: 0,
                  background: goal.trim() && !streaming ? "linear-gradient(135deg, #6366F1, #4F46E5)" : T.bgHover,
                  border: `1px solid ${goal.trim() && !streaming ? "transparent" : T.border}`,
                  color: goal.trim() && !streaming ? "#fff" : T.textFaint,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: goal.trim() && !streaming ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                  transform: "none",
                }}
                onMouseEnter={e => { if (goal.trim() && !streaming) e.currentTarget.style.transform = "scale(1.05)"; }}
                onMouseLeave={e => (e.currentTarget.style.transform = "none")}
              >
                <Send size={17} />
              </button>
            </div>
            {!connected && (
              <p style={{ fontSize: 11, color: T.textFaint, textAlign: "center", marginTop: 8 }}>
                ⚠ Demo mode — responses are simulated
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}; border-radius: 3px; }
        .group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }
        @media (min-width: 768px) {
          .md\\:hidden { display: none !important; }
          .md\\:relative { position: relative !important; }
          .md\\:z-auto { z-index: auto !important; }
          .md\\:ml-\\[260px\\] { margin-left: 260px !important; }
        }
        @media (max-width: 767px) {
          .hidden.lg\\:flex { display: none !important; }
        }
        @media (min-width: 1024px) {
          .hidden.lg\\:flex { display: flex !important; }
        }
      `}</style>
    </div>
  );
}