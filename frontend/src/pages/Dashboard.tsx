import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Square, Plus, Trash2, LogOut, MessageSquare,
  Menu, X, Sun, Moon, Activity, Copy, Check,
  Zap, Search, Terminal, BarChart3, Target, PenLine, Sparkles,
  Paperclip, FileText, XCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../store/useAuth";
import { useHistory, Message } from "../store/useHistory";

const API_URL = import.meta.env.VITE_API_URL || "https://muneeb01x-agentflow-os.hf.space";

const AGENT_META: Record<string, {
  Icon: LucideIcon;
  color: string; colorLight: string; bg: string; bgLight: string;
  border: string; borderLight: string; label: string;
}> = {
  supervisor: { Icon: Zap,       color: "#F59E0B", colorLight: "#9A5B0A", bg: "rgba(245,158,11,0.14)", bgLight: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.32)", borderLight: "rgba(154,91,10,0.30)",  label: "Supervisor" },
  researcher: { Icon: Search,    color: "#60A5FA", colorLight: "#1D4ED8", bg: "rgba(96,165,250,0.14)", bgLight: "rgba(29,78,216,0.10)",  border: "rgba(96,165,250,0.32)", borderLight: "rgba(29,78,216,0.28)",  label: "Researcher" },
  coder:      { Icon: Terminal,  color: "#34D399", colorLight: "#047857", bg: "rgba(52,211,153,0.14)", bgLight: "rgba(4,120,87,0.10)",   border: "rgba(52,211,153,0.32)", borderLight: "rgba(4,120,87,0.28)",   label: "Coder" },
  analyst:    { Icon: BarChart3, color: "#FB923C", colorLight: "#B34608", bg: "rgba(251,146,60,0.14)", bgLight: "rgba(179,70,8,0.10)",   border: "rgba(251,146,60,0.32)", borderLight: "rgba(179,70,8,0.28)",   label: "Analyst" },
  critic:     { Icon: Target,    color: "#F87171", colorLight: "#B91C1C", bg: "rgba(248,113,113,0.14)", bgLight: "rgba(185,28,28,0.10)", border: "rgba(248,113,113,0.32)", borderLight: "rgba(185,28,28,0.28)",  label: "Critic" },
  writer:     { Icon: PenLine,   color: "#22D3EE", colorLight: "#0E7490", bg: "rgba(34,211,238,0.14)", bgLight: "rgba(14,116,144,0.10)", border: "rgba(34,211,238,0.32)", borderLight: "rgba(14,116,144,0.28)", label: "Writer" },
  system:     { Icon: Sparkles,  color: "#94A3B8", colorLight: "#475569", bg: "rgba(148,163,184,0.12)", bgLight: "rgba(71,85,105,0.09)", border: "rgba(148,163,184,0.24)", borderLight: "rgba(71,85,105,0.22)",  label: "System" },
};

const PIPE = ["supervisor", "researcher", "coder", "analyst", "critic", "writer"];

const SUGGESTIONS = [
  { text: "Research what LangGraph is and write a Python example", icon: "🔬", label: "Research + Code" },
  { text: "Write a Python calculator with all 4 operations and test it", icon: "🧮", label: "Code task" },
  { text: "Explain how transformer attention works in detail", icon: "🧠", label: "Deep research" },
  { text: "Write a Python web scraper for Hacker News headlines", icon: "🕷️", label: "Scraper" },
];

const DEMO_STEPS = [
  { node: "supervisor", content: "Breaking down your goal into subtasks:\n1. Research the topic thoroughly\n2. Write and execute code if needed\n3. Synthesise a final polished response" },
  { node: "researcher", content: "Searched Tavily + ArXiv + Wikipedia.\n\n**Key findings:**\n- Gathered authoritative sources\n- Identified relevant technical details\n- Compiled structured information for the coder" },
  { node: "coder", content: "```python\n# Generated and executed successfully\nresult = [n for n in range(10)]\nprint(f'Output: {result}')\n```\n\n✅ Execution successful. No errors." },
  { node: "critic", content: "**Quality Score: 0.91 / 1.00 ✓**\n\n- Accuracy ✓\n- Completeness ✓\n- Code validity ✓\n\nThreshold cleared — proceeding to Writer." },
  { node: "writer", content: "Here is your comprehensive answer based on autonomous research and verified code execution. The agents planned, researched, coded, reviewed quality, and synthesised this response — completely without intervention." },
];

// ── Markdown renderer ─────────────────────────────────────────────────────────
function CodeBlock({ code, lang, dark }: { code: string; lang: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ margin: "12px 0", borderRadius: 10, overflow: "hidden", border: `1px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(15,15,20,0.12)"}`, boxShadow: dark ? "none" : "0 1px 2px rgba(15,15,20,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", background: dark ? "rgba(255,255,255,0.05)" : "rgba(15,15,20,0.035)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.07)" : "rgba(15,15,20,0.08)"}` }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: dark ? "rgba(255,255,255,0.4)" : "rgba(15,15,20,0.45)", textTransform: "lowercase" }}>{lang || "code"}</span>
        <button onClick={copy} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 5, background: "transparent", border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(15,15,20,0.14)"}`, color: dark ? "rgba(255,255,255,0.5)" : "rgba(15,15,20,0.5)", fontSize: 10, cursor: "pointer", transition: "all 0.15s" }}>
          {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "16px 18px", overflowX: "auto", background: dark ? "#0B0B0D" : "#FAFAFC", fontSize: 12.5, lineHeight: 1.7, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: dark ? "#D3DAE6" : "#1E2530" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MarkdownContent({ content, dark }: { content: string; dark: boolean }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (text: string, key: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return (
      <span key={key}>
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**"))
            return <strong key={j} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
          if (part.startsWith("`") && part.endsWith("`"))
            return <code key={j} style={{ fontFamily: "monospace", fontSize: "0.85em", padding: "2px 6px", borderRadius: 4, background: dark ? "rgba(255,255,255,0.1)" : "rgba(15,15,20,0.06)", border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,15,20,0.09)"}` }}>{part.slice(1, -1)}</code>;
          return part;
        })}
      </span>
    );
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { codeLines.push(lines[i]); i++; }
      elements.push(<CodeBlock key={`cb-${i}`} code={codeLines.join("\n")} lang={lang} dark={dark} />);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={`h2-${i}`} style={{ fontSize: 15, fontWeight: 700, margin: "18px 0 8px", letterSpacing: -0.3, paddingBottom: 6, borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(15,15,20,0.09)"}` }}>{renderInline(line.slice(3), `h2i-${i}`)}</h2>);
      i++; continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<h3 key={`h3-${i}`} style={{ fontSize: 13.5, fontWeight: 600, margin: "14px 0 5px", color: dark ? "rgba(241,241,243,0.9)" : "rgba(15,15,20,0.85)" }}>{renderInline(line.slice(4), `h3i-${i}`)}</h3>);
      i++; continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={`li-${i}`} style={{ display: "flex", gap: 10, margin: "4px 0", paddingLeft: 2 }}>
          <span style={{ color: dark ? "rgba(255,255,255,0.3)" : "rgba(15,15,20,0.32)", flexShrink: 0, marginTop: 3, fontSize: 8 }}>◆</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.75 }}>{renderInline(line.slice(2), `lii-${i}`)}</span>
        </div>
      );
      i++; continue;
    }
    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      elements.push(
        <div key={`nl-${i}`} style={{ display: "flex", gap: 10, margin: "4px 0", paddingLeft: 2 }}>
          <span style={{ color: dark ? "rgba(255,255,255,0.35)" : "rgba(15,15,20,0.38)", flexShrink: 0, fontSize: 12, fontWeight: 600, minWidth: 18, paddingTop: 1 }}>{numMatch[1]}.</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.75 }}>{renderInline(numMatch[2], `nli-${i}`)}</span>
        </div>
      );
      i++; continue;
    }
    if (line.trim() === "") { elements.push(<div key={`br-${i}`} style={{ height: 8 }} />); i++; continue; }
    elements.push(<p key={`p-${i}`} style={{ margin: "4px 0", fontSize: 13.5, lineHeight: 1.8 }}>{renderInline(line, `pi-${i}`)}</p>);
    i++;
  }
  return <div>{elements}</div>;
}

interface DashboardProps { onSignOut?: () => void; }

export default function Dashboard({ onSignOut }: DashboardProps) {
  const { user, token, logout, isTokenExpired } = useAuth();
  const { chats, activeChatId, createChat, addMessage, replaceOrAddMessage, setActiveChat, deleteChat, getUserChats } = useHistory();

  const [goal, setGoal] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeNode, setActiveNode] = useState("");
  const [done, setDone] = useState(new Set<string>());
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(true);
  const [showSignOut, setShowSignOut] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{name: string; type: string; content: string; size: number} | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const streamingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const userChats = user ? getUserChats(user.user_id) : [];
  const activeChat = chats.find((c) => c.id === activeChatId);
  const msgs = activeChat?.messages || [];

  const T = dark ? {
    bg:          "#09090D",
    bgPanel:     "#141418",
    bgElevated:  "#1C1C22",
    bgInput:     "#17171C",
    bgHover:     "rgba(255,255,255,0.055)",
    bgActive:    "rgba(255,255,255,0.10)",
    border:      "rgba(255,255,255,0.13)",
    borderStrong:"rgba(255,255,255,0.22)",
    borderLight: "rgba(255,255,255,0.07)",
    text:        "#F5F5F7",
    textMuted:   "rgba(245,245,247,0.62)",
    textFaint:   "rgba(245,245,247,0.40)",
    sidebarBg:   "#0C0C10",
    accent:      "#7C7AFF",
    accentText:  "#FFFFFF",
    accentSoft:  "rgba(124,122,255,0.18)",
    shadowSm:    "0 1px 2px rgba(0,0,0,0.45)",
    shadowMd:    "0 12px 32px -8px rgba(0,0,0,0.6)",
    userBubble:  { bg: "rgba(124,122,255,0.20)", border: "rgba(124,122,255,0.42)", text: "#DEDEFF" },
  } : {
    bg:          "#E7E8ED",
    bgPanel:     "#FFFFFF",
    bgElevated:  "#FFFFFF",
    bgInput:     "#FFFFFF",
    bgHover:     "rgba(17,17,28,0.055)",
    bgActive:    "rgba(17,17,28,0.095)",
    border:      "rgba(17,17,28,0.16)",
    borderStrong:"rgba(17,17,28,0.26)",
    borderLight: "rgba(17,17,28,0.09)",
    text:        "#101018",
    textMuted:   "rgba(16,16,24,0.66)",
    textFaint:   "rgba(16,16,24,0.46)",
    sidebarBg:   "#FFFFFF",
    accent:      "#433BE0",
    accentText:  "#FFFFFF",
    accentSoft:  "rgba(67,59,224,0.10)",
    shadowSm:    "0 1px 3px rgba(16,16,24,0.10), 0 1px 1px rgba(16,16,24,0.06)",
    shadowMd:    "0 18px 36px -14px rgba(16,16,24,0.28), 0 4px 12px rgba(16,16,24,0.08)",
    userBubble:  { bg: "rgba(67,59,224,0.10)", border: "rgba(67,59,224,0.30)", text: "#332BB8" },
  };

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, streaming]);

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.ok ? setConnected(true) : setConnected(false))
      .catch(() => setConnected(false));
  }, []);

  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  const addMsg = (chatId: string, msg: Message) => addMessage(chatId, msg);

  const handleFileUpload = async (file: File) => {
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/api/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.detail || "Upload failed."); return; }
      setUploadedFile({ name: data.file_name, type: data.file_type, content: data.file_content, size: data.file_size });
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };
  // Replace last message from same node instead of appending — fixes coder/critic duplicates on retries
  const replaceMsg = (chatId: string, msg: Message) => replaceOrAddMessage(chatId, msg);

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
    if (activeChatId) addMsg(activeChatId, { role: "agent", content: "Run stopped by user.", node: "system", ts: now() });
  };

  const runReal = (chatId: string, g: string, file?: typeof uploadedFile) => {
    if (isTokenExpired()) { logout(); runDemo(chatId); return; }
    setStreaming(true); streamingRef.current = true; setDone(new Set());
    // Build URL — file content goes as query param if small enough, otherwise truncate
    let url = `${API_URL}/api/runs/stream?goal=${encodeURIComponent(g)}&token=${token}`;
    if (file) {
      url += `&file_name=${encodeURIComponent(file.name)}&file_type=${encodeURIComponent(file.type)}`;
      // File content sent via URL (EventSource doesn't support POST body)
      // Truncate to 4000 chars for URL safety — full content already on backend after upload
      const contentPreview = encodeURIComponent(file.content.slice(0, 4000));
      url += `&file_content=${contentPreview}`;
    }
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("node_update", (e) => {
      const data = JSON.parse(e.data);
      setActiveNode(data.node);
      setDone(p => new Set([...p, data.node]));
      const content = data.messages?.[0]?.content || data.status || "";
      if (!content || data.node === "writer") return;
      // Use replace for coder/critic to avoid showing every retry attempt
      if (data.node === "coder" || data.node === "critic") {
        replaceMsg(chatId, { role: "agent", content, node: data.node, ts: now() });
      } else {
        addMsg(chatId, { role: "agent", content, node: data.node, ts: now() });
      }
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
      if (isTokenExpired()) { logout(); return; }
      addMsg(chatId, { role: "agent", content: "Connection error. Please try again.", node: "system", ts: now() });
    });
  };

  const runDemo = async (chatId: string) => {
    setStreaming(true); streamingRef.current = true; setDone(new Set());
    for (const d of DEMO_STEPS) {
      if (!streamingRef.current) break;
      setActiveNode(d.node);
      await new Promise(r => setTimeout(r, 1400));
      if (!streamingRef.current) break;
      addMsg(chatId, { role: "agent", content: d.content, node: d.node, ts: now() });
      setDone(p => new Set([...p, d.node]));
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
    if (connected && token && !token.startsWith("demo-")) runReal(chatId, text, uploadedFile || undefined);
    else runDemo(chatId);
    setUploadedFile(null); // clear file after sending
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
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", fontFamily: "'Inter', system-ui, sans-serif", transition: "background 0.25s ease, color 0.25s ease" }}>

      {/* ── Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div className="md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
            <motion.aside initial={{ x: -268 }} animate={{ x: 0 }} exit={{ x: -268 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 260, zIndex: 30, background: T.sidebarBg, borderRight: `1px solid ${T.borderStrong}`, boxShadow: dark ? "4px 0 24px rgba(0,0,0,0.3)" : "4px 0 24px rgba(16,16,24,0.09)", display: "flex", flexDirection: "column" }}
              className="md:relative md:z-auto">

              <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${T.borderLight}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: dark ? "0 2px 10px rgba(99,102,241,0.35)" : "0 2px 8px rgba(99,102,241,0.25)" }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>AF</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.4 }}>AgentFlow</div>
                      <div style={{ fontSize: 9, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 1 }}>Multi-agent OS</div>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="md:hidden"
                    style={{ color: T.textFaint, padding: 5, borderRadius: 6, background: "transparent", border: "none", cursor: "pointer" }}>
                    <X size={15} />
                  </button>
                </div>
                <button onClick={newChat}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 9, background: "linear-gradient(135deg, #6366F1, #4F46E5)", border: "1px solid transparent", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s", boxShadow: dark ? "0 2px 10px rgba(99,102,241,0.3)" : "0 4px 14px rgba(79,70,229,0.32)" }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}>
                  <Plus size={13} /> New conversation
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                {userChats.length === 0 ? (
                  <div style={{ padding: "48px 16px", textAlign: "center" }}>
                    <MessageSquare size={24} style={{ color: T.textFaint, margin: "0 auto 10px", display: "block" }} />
                    <div style={{ fontSize: 12, color: T.textFaint, fontWeight: 500 }}>No conversations yet</div>
                    <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, opacity: 0.8 }}>Type a goal below to start</div>
                  </div>
                ) : userChats.map(chat => (
                  <div key={chat.id} onClick={() => setActiveChat(chat.id)} className="group"
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: activeChatId === chat.id ? T.bgActive : "transparent", border: `1px solid ${activeChatId === chat.id ? T.border : "transparent"}`, marginBottom: 1, transition: "all 0.1s" }}
                    onMouseEnter={e => { if (activeChatId !== chat.id) e.currentTarget.style.background = T.bgHover; }}
                    onMouseLeave={e => { if (activeChatId !== chat.id) e.currentTarget.style.background = "transparent"; }}>
                    <MessageSquare size={12} style={{ color: T.textFaint, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: activeChatId === chat.id ? 500 : 400 }}>{chat.title}</div>
                      <div style={{ fontSize: 10, color: T.textFaint, marginTop: 1 }}>{new Date(chat.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}
                      style={{ opacity: 0, padding: 3, borderRadius: 4, background: "transparent", border: "none", cursor: "pointer", color: "#EF4444", transition: "opacity 0.1s", flexShrink: 0 }}
                      className="group-hover:opacity-100">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ padding: "10px 10px 16px", borderTop: `1px solid ${T.borderLight}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", marginBottom: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#10B981" : "#F59E0B", boxShadow: connected ? "0 0 6px #10B981" : "0 0 6px rgba(245,158,11,0.6)", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: connected ? (dark ? "#34D399" : "#047857") : (dark ? "#FBBF24" : "#B45309"), fontWeight: 500 }}>{connected ? "Live agents connected" : "Demo mode"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 9, background: T.bgHover, border: `1px solid ${T.borderLight}`, marginBottom: 6 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #6366F1, #06B6D4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{avatarLetter}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || firstName}</div>
                    <div style={{ fontSize: 10, color: T.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
                  </div>
                </div>
                {showSignOut ? (
                  <div style={{ padding: "10px", borderRadius: 9, background: dark ? "rgba(239,68,68,0.09)" : "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.22)" }}>
                    <div style={{ fontSize: 11.5, color: T.textMuted, marginBottom: 8 }}>Sign out of AgentFlow?</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={handleSignOut} style={{ flex: 1, padding: "7px 0", borderRadius: 7, background: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Sign out</button>
                      <button onClick={() => setShowSignOut(false)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, background: T.bgHover, border: `1px solid ${T.border}`, color: T.textMuted, fontSize: 11, cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowSignOut(true)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "7px 10px", borderRadius: 8, background: "transparent", border: "none", color: T.textFaint, fontSize: 12, cursor: "pointer", transition: "all 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#EF4444"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.textFaint; }}>
                    <LogOut size={13} /> Sign out
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh" }} className={sidebarOpen ? "md:ml-[260px]" : ""}>

        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 54, borderBottom: `1px solid ${T.border}`, background: dark ? "rgba(9,9,13,0.85)" : "rgba(231,232,237,0.85)", backdropFilter: "blur(10px)", boxShadow: dark ? "none" : "0 4px 16px rgba(16,16,24,0.05)", flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ padding: 7, borderRadius: 8, background: "transparent", border: "none", color: T.textMuted, cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.background = T.bgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
            <Menu size={16} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
              {activeChat ? activeChat.title : "New conversation"}
            </span>
          </div>

          {/* Pipeline stepper */}
          <div className="hidden lg:flex" style={{ alignItems: "center", padding: "6px 10px", borderRadius: 10, background: T.bgPanel, border: `1px solid ${T.border}`, boxShadow: T.shadowSm }}>
            {PIPE.map((n, idx) => {
              const isA = activeNode === n;
              const isD = done.has(n);
              const m = AGENT_META[n];
              const Icon = m.Icon;
              const color = dark ? m.color : m.colorLight;
              const nodeBg = (isA || isD) ? (dark ? m.bg : m.bgLight) : "transparent";
              const nodeBorder = (isA || isD) ? (dark ? m.border : m.borderLight) : T.border;
              const lineColor = isD ? color : T.border;
              return (
                <div key={n} style={{ display: "flex", alignItems: "center" }}>
                  {idx > 0 && <div style={{ width: 12, height: 1.5, background: lineColor, opacity: isD ? 0.6 : 1, transition: "background 0.2s" }} />}
                  <div title={m.label} style={{ position: "relative", width: 24, height: 24, borderRadius: "50%", background: nodeBg, border: `1.5px solid ${nodeBorder}`, display: "flex", alignItems: "center", justifyContent: "center", color: (isA || isD) ? color : T.textFaint, transition: "all 0.2s" }}>
                    <Icon size={11.5} strokeWidth={2.4} />
                    {isA && (
                      <motion.span
                        animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.35, 1] }}
                        transition={{ duration: 1.3, repeat: Infinity }}
                        style={{ position: "absolute", inset: -3, borderRadius: "50%", border: `1.5px solid ${color}` }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {streaming && (
              <button onClick={stop} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: dark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)", color: dark ? "#F87171" : "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Square size={10} fill="currentColor" /> Stop
              </button>
            )}
            <button onClick={() => setDark(!dark)} style={{ padding: 7, borderRadius: 8, background: T.bgPanel, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, color: T.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={msgsRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
          {msgs.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 130px)", padding: "40px 0" }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: "100%", maxWidth: 580, textAlign: "center" }}>
                <div style={{ position: "relative", width: 58, height: 58, margin: "0 auto 20px" }}>
                  <div style={{ width: 58, height: 58, borderRadius: 16, background: "linear-gradient(135deg, #6366F1, #06B6D4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: dark ? "0 10px 28px rgba(99,102,241,0.32)" : "0 10px 28px rgba(99,102,241,0.28)" }}>
                    <Activity size={25} color="#fff" strokeWidth={2.1} />
                  </div>
                  {connected && <span style={{ position: "absolute", top: -2, right: -2, width: 13, height: 13, borderRadius: "50%", background: "#10B981", border: `2.5px solid ${T.bg}`, boxShadow: "0 0 6px #10B981" }} />}
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, letterSpacing: -0.5 }}>Hey {firstName} 👋</h2>
                <p style={{ fontSize: 14, color: T.textMuted, marginBottom: 32, lineHeight: 1.65, maxWidth: 420, margin: "0 auto 32px" }}>
                  {connected ? "Six specialized agents are ready. Describe what you want to accomplish." : "Running in demo mode. Type any goal to see the agents in action."}
                </p>

                <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", marginBottom: 32 }}>
                  {PIPE.map(n => {
                    const m = AGENT_META[n];
                    const Icon = m.Icon;
                    const color = dark ? m.color : m.colorLight;
                    return (
                      <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: dark ? m.bg : m.bgLight, border: `1px solid ${dark ? m.border : m.borderLight}`, fontSize: 11.5, fontWeight: 600, color }}>
                        <Icon size={12} strokeWidth={2.3} /> {m.label}
                      </span>
                    );
                  })}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 560, margin: "0 auto" }}>
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button key={s.text} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
                      onClick={() => send(s.text)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "14px 14px", borderRadius: 12, background: T.bgPanel, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, color: T.textMuted, fontSize: 12.5, textAlign: "left", cursor: "pointer", transition: "all 0.15s", lineHeight: 1.5 }}
                      onMouseEnter={e => { e.currentTarget.style.background = dark ? T.bgHover : "#FFFFFF"; e.currentTarget.style.borderColor = dark ? "rgba(99,102,241,0.35)" : "rgba(79,70,229,0.3)"; e.currentTarget.style.color = T.text; e.currentTarget.style.boxShadow = T.shadowMd; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = T.bgPanel; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.boxShadow = T.shadowSm; e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{s.icon}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</span>
                      </div>
                      <span>{s.text}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          ) : (
            <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 0 8px" }}>
              <AnimatePresence initial={false}>
                {msgs.map((m, idx) => {
                  const isUser = m.role === "user";
                  const meta = AGENT_META[m.node || "system"] || AGENT_META.system;
                  const metaColor = dark ? meta.color : meta.colorLight;
                  const metaBg = dark ? meta.bg : meta.bgLight;
                  const metaBorder = dark ? meta.border : meta.borderLight;
                  const isWriter = m.node === "writer";
                  const isCoder = m.node === "coder";
                  const isCritic = m.node === "critic";
                  const isSystem = m.node === "system";

                  if (isUser) {
                    return (
                      <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                        style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
                        <div style={{ maxWidth: "65%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 10, color: T.textFaint }}>{m.ts}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: T.textFaint }}>{user?.name?.split(" ")[0] || "You"}</span>
                          </div>
                          <div style={{ padding: "11px 16px", borderRadius: "16px 4px 16px 16px", background: T.userBubble.bg, border: `1px solid ${T.userBubble.border}`, color: T.userBubble.text, fontSize: 14, lineHeight: 1.65, fontWeight: dark ? 400 : 500 }}>
                            {m.content}
                          </div>
                        </div>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                      style={{ marginBottom: isWriter ? 24 : 12 }}>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 2 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: metaBg, border: `1px solid ${metaBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <meta.Icon size={12} color={metaColor} strokeWidth={2.3} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: metaColor, textTransform: "uppercase", letterSpacing: "0.1em" }}>{meta.label}</span>
                        {m.ts && <span style={{ fontSize: 10, color: T.textFaint }}>{m.ts}</span>}
                        {isWriter && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: dark ? "rgba(34,211,238,0.12)" : "rgba(14,116,144,0.08)", border: `1px solid ${dark ? "rgba(34,211,238,0.25)" : "rgba(14,116,144,0.22)"}`, color: dark ? "#22D3EE" : "#0E7490", fontWeight: 600 }}>Final Answer</span>}
                        {isCritic && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: dark ? "rgba(248,113,113,0.1)" : "rgba(185,28,28,0.07)", border: `1px solid ${dark ? "rgba(248,113,113,0.22)" : "rgba(185,28,28,0.18)"}`, color: dark ? "#F87171" : "#B91C1C" }}>Review</span>}
                      </div>

                      <div style={{
                        marginLeft: 30,
                        padding: isSystem ? "8px 14px" : "14px 18px",
                        borderRadius: isSystem ? 8 : 12,
                        background: isWriter
                          ? dark ? "rgba(34,211,238,0.055)" : "rgba(14,116,144,0.04)"
                          : isSystem ? T.bgHover
                          : T.bgPanel,
                        border: `1px solid ${isWriter ? (dark ? "rgba(34,211,238,0.2)" : "rgba(14,116,144,0.2)") : isSystem ? T.borderLight : T.border}`,
                        color: isSystem ? T.textFaint : T.text,
                        fontSize: isSystem ? 12 : 13.5,
                        fontFamily: (isCoder && !isWriter) ? "monospace" : "inherit",
                        lineHeight: 1.75,
                        boxShadow: isSystem ? "none" : T.shadowSm,
                      }}>
                        {isSystem
                          ? <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                          : <MarkdownContent content={m.content} dark={dark} />
                        }
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {streaming && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 2 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: activeNode ? (dark ? AGENT_META[activeNode]?.bg : AGENT_META[activeNode]?.bgLight) : T.bgHover, border: `1px solid ${activeNode ? (dark ? AGENT_META[activeNode]?.border : AGENT_META[activeNode]?.borderLight) : T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {activeNode
                        ? (() => { const ActiveIcon = AGENT_META[activeNode].Icon; return <ActiveIcon size={12} color={dark ? AGENT_META[activeNode].color : AGENT_META[activeNode].colorLight} strokeWidth={2.3} />; })()
                        : <Sparkles size={12} color={T.textFaint} strokeWidth={2.3} />}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: activeNode ? (dark ? AGENT_META[activeNode]?.color : AGENT_META[activeNode]?.colorLight) : T.textFaint, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      {activeNode ? AGENT_META[activeNode]?.label : "Processing"}
                    </span>
                  </div>
                  <div style={{ marginLeft: 30, display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, background: T.bgPanel, border: `1px solid ${T.border}`, boxShadow: T.shadowSm, width: "fit-content" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0, 1, 2].map(i => (
                        <motion.span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: activeNode ? (dark ? AGENT_META[activeNode]?.color : AGENT_META[activeNode]?.colorLight) : T.accent, display: "block" }}
                          animate={{ y: [0, -4, 0], opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      {activeNode ? `${AGENT_META[activeNode]?.label} is working…` : "Processing…"}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px 20px", borderTop: `1px solid ${T.border}`, background: T.bg, flexShrink: 0 }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <div
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = inputFocused ? "rgba(99,102,241,0.45)" : T.border; }}
              onDrop={e => { e.currentTarget.style.borderColor = T.border; handleFileDrop(e); }}
              style={{
              display: "flex", gap: 8, alignItems: "center", padding: "6px 6px 6px 12px", borderRadius: 16,
              background: T.bgInput,
              border: `1px solid ${inputFocused ? (dark ? "rgba(99,102,241,0.45)" : "rgba(79,70,229,0.4)") : T.border}`,
              boxShadow: inputFocused
                ? (dark ? `0 0 0 3px rgba(99,102,241,0.15), ${T.shadowMd}` : `0 0 0 3px rgba(79,70,229,0.1), ${T.shadowMd}`)
                : T.shadowMd,
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}>
              {/* Hidden file input */}
              <input ref={fileInputRef} type="file" accept=".csv,.pdf,.txt,.md,.json" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />

              {/* File pill — shown when file is uploaded */}
              {uploadedFile && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 6px", borderRadius: 6, background: dark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)", border: `1px solid rgba(99,102,241,0.3)`, flexShrink: 0, maxWidth: 160 }}>
                  <FileText size={11} color="#6366F1" />
                  <span style={{ fontSize: 11, color: "#6366F1", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{uploadedFile.name}</span>
                  <button onClick={() => setUploadedFile(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "rgba(99,102,241,0.6)", flexShrink: 0 }}>
                    <XCircle size={11} />
                  </button>
                </div>
              )}

              {/* Paperclip upload button */}
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading || streaming}
                style={{ padding: 6, borderRadius: 8, background: "transparent", border: "none", color: uploading ? T.accent : T.textFaint, cursor: uploading ? "wait" : "pointer", flexShrink: 0, display: "flex", alignItems: "center", transition: "color 0.15s" }}
                title="Upload CSV, PDF, or TXT file">
                {uploading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Paperclip size={16} /></motion.div> : <Paperclip size={16} />}
              </button>

              <input ref={inputRef} value={goal} onChange={e => setGoal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={connected ? "Describe a goal for the agents…" : "Type a goal… (demo mode)"}
                disabled={streaming}
                style={{ flex: 1, background: "transparent", border: "none", color: T.text, fontSize: 14, outline: "none", padding: "8px 0" }} />
              <button onClick={() => send()} disabled={!goal.trim() || streaming}
                style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: goal.trim() && !streaming ? "linear-gradient(135deg, #6366F1, #4F46E5)" : T.bgHover, border: `1px solid ${goal.trim() && !streaming ? "transparent" : T.border}`, color: goal.trim() && !streaming ? "#fff" : T.textFaint, display: "flex", alignItems: "center", justifyContent: "center", cursor: goal.trim() && !streaming ? "pointer" : "not-allowed", transition: "all 0.15s", boxShadow: goal.trim() && !streaming ? "0 2px 8px rgba(99,102,241,0.35)" : "none" }}
                onMouseEnter={e => { if (goal.trim() && !streaming) e.currentTarget.style.transform = "scale(1.06)"; }}
                onMouseLeave={e => (e.currentTarget.style.transform = "none")}>
                <Send size={15} />
              </button>
            </div>
            {uploadError && <p style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>⚠ {uploadError}</p>}
            {uploadedFile && !uploadError && (
              <p style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>
                📎 {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB) — agents will analyze this file
              </p>
            )}
            {!connected && <p style={{ fontSize: 11, color: T.textFaint, textAlign: "center", marginTop: 8 }}>⚠ Demo mode — responses are simulated</p>}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${dark ? "rgba(255,255,255,0.1)" : "rgba(17,17,26,0.14)"}; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: ${dark ? "rgba(255,255,255,0.18)" : "rgba(17,17,26,0.22)"}; }
        .group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }
        input::placeholder { color: ${T.textFaint}; }
        @media (min-width: 768px) {
          .md\\:hidden { display: none !important; }
          .md\\:relative { position: relative !important; }
          .md\\:z-auto { z-index: auto !important; }
          .md\\:ml-\\[260px\\] { margin-left: 260px !important; }
        }
        @media (max-width: 767px) { .hidden.lg\\:flex { display: none !important; } }
        @media (min-width: 1024px) { .hidden.lg\\:flex { display: flex !important; } }
        @media (max-width: 640px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}