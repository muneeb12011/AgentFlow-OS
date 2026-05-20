import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  ArrowUpRight, ArrowRight, Terminal as TermIcon, Maximize2, Minimize2,
  X, Send, Square, ChevronRight, Sparkles, Cpu, Database, Code2,
  GitBranch, Search, BarChart3, ShieldCheck, FileText, Zap, Layers,
  Boxes, ServerCog, Activity, Wifi, WifiOff, RotateCcw,
} from "lucide-react";

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

const STEPS = [
  { n: "01", icon: Sparkles, t: "Set a goal", d: "Type anything natural. The system decomposes it into subtasks automatically." },
  { n: "02", icon: GitBranch, t: "Supervisor plans", d: "LangGraph's Supervisor breaks your goal down and assigns each piece to a specialist." },
  { n: "03", icon: Zap, t: "Agents execute", d: "Workers run in sequence — researcher, coder, analyst — each feeding the next." },
  { n: "04", icon: ShieldCheck, t: "Critic reviews", d: "Scores quality 0–1. Below 0.7 triggers a full retry with re-planning." },
  { n: "05", icon: FileText, t: "Writer delivers", d: "Synthesises every output into one polished, cited, professional answer." },
];

const AGENTS = [
  { key: "supervisor", n: "Supervisor", icon: GitBranch, d: "Plans, routes, re-plans. The orchestration brain using LangGraph conditional edges.", tags: ["LangGraph", "StateGraph", "Re-planning"] },
  { key: "researcher", n: "Researcher", icon: Search, d: "Searches Tavily, Wikipedia and ArXiv inside an agentic bind_tools() loop.", tags: ["Tavily", "Wikipedia", "ArXiv"] },
  { key: "coder", n: "Coder", icon: Code2, d: "Writes Python → sandbox → reads error → fixes → retries. Up to 4 self-heal attempts.", tags: ["Subprocess", "Self-heal", "Sandbox"] },
  { key: "analyst", n: "Analyst", icon: BarChart3, d: "SQL queries, pandas analysis, numerical reasoning. All quantitative work.", tags: ["SQL", "pandas", "Data"] },
  { key: "critic", n: "Critic", icon: ShieldCheck, d: "Scores every output 0.0–1.0. Below 0.7 forces a retry. Quality gate every run.", tags: ["Scoring", "Retry", "0.7 gate"] },
  { key: "writer", n: "Writer", icon: FileText, d: "Synthesises all worker outputs into one polished, cited final response.", tags: ["Synthesis", "Citation", "Final"] },
];

const STACK = [
  { cat: "Orchestration", icon: GitBranch, items: ["LangGraph 0.2", "StateGraph", "MemorySaver", "Cond. edges"] },
  { cat: "Agents", icon: Boxes, items: ["LangChain", "bind_tools()", "Agentic loop", "Tool registry"] },
  { cat: "LLM", icon: Cpu, items: ["Groq API", "llama-3.3-70b", "500+ tok/s", "Cost tracking"] },
  { cat: "Backend", icon: ServerCog, items: ["FastAPI", "SSE streaming", "JWT auth", "Multi-tenant"] },
  { cat: "Frontend", icon: Layers, items: ["React 18", "TypeScript", "Framer Motion", "Zustand"] },
  { cat: "Infra", icon: Database, items: ["Docker Compose", "PostgreSQL", "Redis", "LangSmith"] },
];

const TICKS = ["Supervisor", "Researcher", "Coder", "Analyst", "Critic", "Writer", "LangGraph", "LangChain", "Groq LLM", "FastAPI", "Self-Healing", "LangSmith", "SSE Streaming", "Multi-Tenant", "0.7 Quality Gate"];

const SUGGESTIONS = [
  "Research what LangGraph is and write a Python example",
  "Write a Python calculator and test it",
  "Explain how transformer attention works",
  "Write a Python web scraper for news headlines",
];

const DEMO_STEPS = [
  { node: "supervisor", content: "Breaking down goal:\n1. Research LLM agent architectures\n2. Write Python executor demo\n3. Synthesise into final response" },
  { node: "researcher", content: "Searched Tavily + ArXiv:\n— ReAct (Yao et al. 2022): reasoning + acting\n— LangGraph: stateful DAGs for multi-agent\n— Groq: 500+ tok/s speculative decoding" },
  { node: "coder", content: 'Generated and executed:\n\nfrom langchain_groq import ChatGroq\nfrom langgraph.graph import StateGraph\nllm = ChatGroq(model="llama-3.3-70b")\ngraph = StateGraph(State)\n\n✓ Executed. No errors.' },
  { node: "critic", content: "Quality score: 0.91 ✓\nAccuracy ✓  Completeness ✓  Code validity ✓\nNo retry required — proceeding to writer." },
  { node: "writer", content: "LLM agents combine a language model with external tools in a plan-execute loop. LangGraph enables stateful multi-agent graphs where a Supervisor routes tasks to specialists, a Critic enforces quality (0.7 threshold), and a Writer synthesises the final answer — all autonomously." },
];

function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    const orbs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: 240 + Math.random() * 220,
      hue: [200, 180, 220, 160, 30][i],
      alpha: 0.05 + Math.random() * 0.04,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      orbs.forEach((o) => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r) o.x = W + o.r;
        if (o.x > W + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = H + o.r;
        if (o.y > H + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},80%,55%,${o.alpha})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}

function Nav({ onLaunch, onDocs }: { onLaunch: () => void; onDocs: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "glass border-b border-white/[0.06]" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-5 md:px-10 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 flex items-center justify-center">
            <div className="absolute inset-1 rounded-md bg-white/[0.04] grid-bg" />
            <span className="relative font-mono text-[10px] font-bold text-white">AF</span>
          </div>
          <div className="leading-tight">
            <div className="font-display font-extrabold text-[15px] tracking-tight text-white">AgentFlow</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/40 -mt-0.5">Multi-agent OS</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {["Pipeline", "Agents", "Stack", "Terminal"].map((l) => (
            <a key={l} href={`#${l.toLowerCase()}`} className="px-3 py-2 text-xs font-medium text-white/55 hover:text-white transition-colors">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-300">Online</span>
          </div>
          <button onClick={onDocs} className="hidden sm:inline-flex font-mono text-[10px] uppercase tracking-[0.12em] px-3 py-2 rounded-md border border-white/10 text-white/70 hover:text-white hover:border-white/25 transition-all">Docs</button>
          <button onClick={onLaunch} className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] px-3.5 py-2 rounded-md bg-white text-black hover:bg-white/90 transition-all hover:-translate-y-0.5">
            Launch <ArrowUpRight className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </div>
    </nav>
  );
}

function Hero({ onLaunch }: { onLaunch: () => void }) {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 600], [0, -80]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-24 pb-16 bg-[#050505]">
      <Backdrop />
      <div className="absolute inset-0 grid-bg opacity-50" />
      <motion.div style={{ opacity }} className="absolute right-0 top-1/2 -translate-y-1/2 font-display font-extrabold leading-none text-white/[0.025] pointer-events-none select-none">
        <div className="text-[clamp(260px,32vw,560px)]">AF</div>
      </motion.div>
      <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-10 w-full grid lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
        <motion.div style={{ y: y1 }}>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Autonomous · LangGraph · Groq</span>
          </motion.div>
          <h1 className="font-display font-extrabold tracking-tighter text-white leading-[0.86] text-[clamp(54px,9vw,140px)] mb-7">
            <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.05, ease: [0.16, 1, 0.3, 1] }} className="block">The OS</motion.span>
            <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }} className="block">
              for AI{" "}
              <span className="relative inline-block">
                <span className="bg-clip-text text-transparent bg-gradient-to-br from-cyan-300 via-blue-400 to-purple-400">agents</span>
                <span className="absolute -bottom-2 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 rounded-full opacity-70" />
              </span>
            </motion.span>
            <motion.span initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }} className="block text-white/15" style={{ WebkitTextStroke: "1px rgba(255,255,255,0.18)", WebkitTextFillColor: "transparent" }}>
              that ship.
            </motion.span>
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-base md:text-lg text-white/55 leading-relaxed max-w-xl mb-10 font-body">
            Give it a goal. It plans, researches, writes code, heals its own errors, scores its own work, and delivers a polished answer — completely autonomously.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }} className="flex flex-wrap gap-3">
            <button onClick={onLaunch} className="group relative inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-black font-mono text-xs uppercase tracking-[0.14em] font-semibold overflow-hidden hover:-translate-y-0.5 transition-transform">
              <span className="absolute inset-0 shine pointer-events-none" />
              <TermIcon className="w-4 h-4" /> Open terminal <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
            <button className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/15 bg-white/[0.02] text-white font-mono text-xs uppercase tracking-[0.14em] hover:bg-white/[0.05] hover:border-white/25 hover:-translate-y-0.5 transition-all">
              Read the docs <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} className="relative hidden lg:block">
          <div className="relative card-3d rounded-2xl overflow-hidden glass border border-white/10 glow">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06] bg-black/40">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28CA41]" />
              <span className="font-mono text-[10px] text-white/40 ml-2">live · agentflow</span>
              <Activity className="w-3 h-3 text-emerald-400 ml-auto" />
            </div>
            {[
              { l: "Agents online", v: "6/6", s: "All systems ready", c: "text-emerald-300" },
              { l: "Model", v: "llama-3.3", s: "via Groq · 500 tok/s", c: "text-cyan-300" },
              { l: "Quality gate", v: "0.70", s: "Critic threshold", c: "text-yellow-300" },
              { l: "Streaming", v: "SSE", s: "Real-time output", c: "text-purple-300" },
            ].map((r, i) => (
              <motion.div key={r.l} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.08 }} className="px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/35 mb-1">{r.l}</div>
                <div className="font-display font-bold text-2xl text-white leading-none">{r.v}</div>
                <div className={`font-mono text-[10px] mt-1 ${r.c}`}>{r.s}</div>
              </motion.div>
            ))}
            <div className="px-5 py-3 bg-gradient-to-r from-cyan-500/[0.06] via-transparent to-purple-500/[0.06]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-white/40">latency</span>
                <span className="font-mono text-[10px] text-emerald-300">42ms ↓</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: "78%" }} transition={{ duration: 1.6, delay: 1.2 }} className="h-full bg-gradient-to-r from-cyan-400 to-purple-400" />
              </div>
            </div>
          </div>
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full border border-white/10 grid-bg float-y opacity-50" />
          <div className="absolute -bottom-6 -left-6 w-14 h-14 rounded-full border border-cyan-400/20 spin-slow" />
        </motion.div>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
        <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/40 to-transparent" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">scroll</span>
      </motion.div>
    </section>
  );
}

function Ticker() {
  return (
    <div className="relative border-y border-white/[0.06] bg-black overflow-hidden py-3.5">
      <div className="flex w-max ticker">
        {[...TICKS, ...TICKS].map((t, i) => (
          <span key={i} className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 px-7 whitespace-nowrap flex items-center gap-7">
            {t}<span className="text-white/15">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SLabel({ text, color = "#fff" }: { text: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-7 h-px" style={{ background: color }} />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color }}>{text}</span>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="pipeline" className="relative bg-[#050505] py-24 md:py-32 px-5 md:px-10 overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full border border-white/[0.04] pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full border border-white/[0.05] pointer-events-none -translate-y-1/3 translate-x-1/3" />
      <div className="max-w-7xl mx-auto relative">
        <SLabel text="Five steps · zero intervention" color="#94A3B8" />
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="font-display font-extrabold tracking-tighter text-white text-[clamp(40px,7vw,84px)] leading-[0.9] mb-12">
          From goal<br /><span className="text-white/20">to answer.</span>
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.n} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -4 }} className="group relative p-6 rounded-xl border border-white/[0.07] bg-gradient-to-br from-white/[0.025] to-transparent hover:from-white/[0.05] hover:border-white/15 transition-all overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: "radial-gradient(circle, rgba(255,255,255,.06), transparent 70%)" }} />
                <div className="font-mono text-[10px] tracking-[0.18em] text-white/30 mb-5">{s.n}</div>
                <div className="w-10 h-10 rounded-lg border border-white/15 bg-white/[0.04] flex items-center justify-center mb-4 group-hover:bg-white/[0.08] group-hover:border-white/25 transition-all">
                  <Icon className="w-4 h-4 text-white/80 group-hover:text-white" />
                </div>
                <div className="font-display font-bold text-base text-white mb-1.5">{s.t}</div>
                <div className="font-body text-[13px] text-white/50 leading-relaxed">{s.d}</div>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-6 p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {PIPE.map((n, i) => (
              <React.Fragment key={n}>
                <div className="flex flex-col gap-0.5 px-3 py-2 rounded-md border" style={{ borderColor: AGENT_COLORS[n] + "40", background: AGENT_COLORS[n] + "10" }}>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: AGENT_COLORS[n] }}>{n}</span>
                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] opacity-60" style={{ color: AGENT_COLORS[n] }}>
                    {n === "critic" ? "0.7 gate" : n === "writer" ? "final" : n === "supervisor" ? "router" : "worker"}
                  </span>
                </div>
                {i < PIPE.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-white/25" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AgentsSection() {
  return (
    <section id="agents" className="relative bg-[#050505] py-24 md:py-32 px-5 md:px-10 border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto">
        <SLabel text="The specialists" color="#94A3B8" />
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="font-display font-extrabold tracking-tighter text-white text-[clamp(40px,7vw,84px)] leading-[0.9] mb-12">
          Six agents.<br /><span className="text-white/20">One mission.</span>
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((a, i) => {
            const Icon = a.icon;
            const c = AGENT_COLORS[a.key];
            return (
              <motion.div key={a.key} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.55, delay: i * 0.06 }} whileHover={{ y: -6 }} className="group relative p-7 rounded-2xl border border-white/[0.07] bg-[#0B0B0B] overflow-hidden card-3d" style={{ boxShadow: "0 1px 0 rgba(255,255,255,.04) inset" }}>
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }} />
                <div className="absolute -bottom-20 -right-20 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle, ${c}26, transparent 70%)` }} />
                <div className="relative flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center border" style={{ background: `linear-gradient(135deg, ${c}1f, transparent)`, borderColor: c + "40" }}>
                    <Icon className="w-5 h-5" style={{ color: c }} />
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.16em] text-white/25">0{i + 1}</span>
                </div>
                <div className="font-display font-bold text-xl text-white mb-2">{a.n}</div>
                <div className="font-body text-[13.5px] text-white/55 leading-relaxed mb-5">{a.d}</div>
                <div className="flex flex-wrap gap-1.5">
                  {a.tags.map((tg) => (
                    <span key={tg} className="font-mono text-[10px] uppercase tracking-[0.06em] px-2 py-1 rounded-md border" style={{ borderColor: c + "33", color: c, background: c + "0d" }}>{tg}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StackSection() {
  return (
    <section id="stack" className="relative bg-[#050505] py-24 md:py-32 px-5 md:px-10 border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto">
        <SLabel text="Stack" color="#94A3B8" />
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="font-display font-extrabold tracking-tighter text-white text-[clamp(40px,7vw,84px)] leading-[0.9] mb-12">
          Built with<br /><span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-blue-500">precision.</span>
        </motion.h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.07]">
          {STACK.map((col, ci) => {
            const Icon = col.icon;
            return (
              <motion.div key={col.cat} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: ci * 0.05 }} className="group p-5 bg-[#0A0A0A] hover:bg-[#101010] transition-colors">
                <Icon className="w-4 h-4 text-cyan-300/80 mb-3 group-hover:text-cyan-300 transition-colors" />
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 mb-3">{col.cat}</div>
                <div className="space-y-1.5">
                  {col.items.map((it, ii) => (
                    <div key={ii} className="flex items-center gap-1.5 text-[12.5px] text-white/75 font-body group-hover:translate-x-0.5 transition-transform">
                      <ChevronRight className="w-3 h-3 text-white/25 flex-shrink-0" /><span>{it}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

interface Message {
  role: "user" | "agent";
  content: string;
  node?: string;
  ts?: string;
}

interface UsageStats {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
}

function Terminal() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [logging, setLogging] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [goal, setGoal] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeNode, setActiveNode] = useState("");
  const [done, setDone] = useState(new Set<string>());
  const [usage, setUsage] = useState<UsageStats>({ total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const msgsRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);
  const streamingRef = useRef(false);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, [msgs, streaming]);

  useEffect(() => {
    if (fullscreen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  const now = () => new Date().toLocaleTimeString("en-US", { hour12: false });

  const login = async () => {
    setLogging(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || "demo@agentflow.ai", tenant_id: "default" }),
      });
      if (!res.ok) throw new Error("Auth failed");
      const data = await res.json();
      setToken(data.access_token);
      setConnected(true);
      setMsgs((p) => [...p, { role: "agent", content: `✓ Connected to AgentFlow OS\n→ ${API_URL}`, node: "system", ts: now() }]);
    } catch {
      setToken("demo-" + Date.now());
      setConnected(false);
      setMsgs((p) => [...p, { role: "agent", content: "⚠ Backend unreachable — running in demo mode.\nReal agents are not active.", node: "system", ts: now() }]);
    }
    setLogging(false);
  };

  const stop = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    streamingRef.current = false;
    setStreaming(false);
    setActiveNode("");
    setMsgs((p) => [...p, { role: "agent", content: "⚠ Run stopped by user.", node: "system", ts: now() }]);
  };

  const clearMsgs = () => {
    setMsgs([]);
    setDone(new Set());
    setUsage({ total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 });
  };

  const runReal = (g: string) => {
    setStreaming(true);
    streamingRef.current = true;
    setDone(new Set());
    setRunCount((c) => c + 1);

    const es = new EventSource(`${API_URL}/api/runs/stream?goal=${encodeURIComponent(g)}&token=${token}`);
    esRef.current = es;

    es.addEventListener("node_update", (e) => {
      const data = JSON.parse(e.data);
      setActiveNode(data.node);
      setDone((p) => new Set([...p, data.node]));
      const content = data.messages?.[0]?.content || data.status || "";
      if (content) setMsgs((p) => [...p, { role: "agent", content, node: data.node, ts: now() }]);
    });

    es.addEventListener("run_complete", (e) => {
      const data = JSON.parse(e.data);
      if (data.answer) setMsgs((p) => [...p, { role: "agent", content: data.answer, node: "writer", ts: now() }]);
      if (data.token_usage) setUsage(data.token_usage);
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
      setMsgs((p) => [...p, { role: "agent", content: "⚠ Stream error. Check backend logs.", node: "system", ts: now() }]);
    });
  };

  const runDemo = async (g: string) => {
    setStreaming(true);
    streamingRef.current = true;
    setDone(new Set());
    setRunCount((c) => c + 1);

    for (const d of DEMO_STEPS) {
      if (!streamingRef.current) break;
      setActiveNode(d.node);
      await new Promise((r) => setTimeout(r, 1200));
      if (!streamingRef.current) break;
      setMsgs((p) => [...p, { role: "agent", content: d.content, node: d.node, ts: now() }]);
      setDone((p) => new Set([...p, d.node]));
      setActiveNode("");
    }

    if (streamingRef.current) {
      setUsage({ total_tokens: 4821, prompt_tokens: 3200, completion_tokens: 1621, estimated_cost_usd: 0.00482 });
    }
    streamingRef.current = false;
    setStreaming(false);
  };

  const send = (g?: string) => {
    const text = (g ?? goal).trim();
    if (!text || streaming) return;
    setGoal("");
    setMsgs((p) => [...p, { role: "user", content: text, ts: now() }]);
    if (connected && token && !token.startsWith("demo-")) {
      runReal(text);
    } else {
      runDemo(text);
    }
  };

  const SidePanel = (
    <div className="bg-[#0A0A0A] border-l border-white/[0.06] flex flex-col min-w-0 h-full overflow-y-auto">
      <div className="p-4 border-b border-white/[0.06]">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 mb-3 flex items-center gap-2">
          {connected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-white/30" />}
          Connection
        </div>
        {!token ? (
          <>
            <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="your@email.com" className="w-full bg-[#050505] border border-white/[0.08] rounded-md px-3 py-2 text-white text-xs font-mono outline-none mb-2 focus:border-cyan-400/40 transition-colors" />
            <button onClick={login} disabled={logging} className="w-full bg-white text-black rounded-md py-2 font-mono text-[10px] uppercase tracking-[0.12em] font-semibold disabled:opacity-50 hover:bg-white/90 transition">
              {logging ? "Connecting…" : "Connect"}
            </button>
            <div className="font-mono text-[9px] text-white/30 mt-2">Any email works</div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full pulse-dot ${connected ? "bg-emerald-400" : "bg-yellow-400"}`} />
              <span className={`font-mono text-[10px] ${connected ? "text-emerald-300" : "text-yellow-300"}`}>{connected ? "Live backend" : "Demo mode"}</span>
              <button onClick={() => { setToken(""); setConnected(false); }} className="ml-auto text-white/40 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="font-mono text-[9px] text-white/20 truncate">{API_URL}</div>
          </div>
        )}
      </div>

      <div className="p-4 border-b border-white/[0.06]">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 mb-3">Pipeline</div>
        <div className="space-y-1">
          {PIPE.map((n) => {
            const isA = activeNode === n;
            const isD = done.has(n);
            const c = AGENT_COLORS[n];
            return (
              <div key={n} className="flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all" style={{ borderColor: isA ? c + "55" : "transparent", background: isA ? c + "12" : "transparent" }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all" style={{ background: isA ? c : isD ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.12)", boxShadow: isA ? `0 0 8px ${c}` : "none" }} />
                <span className="font-mono text-[11px] capitalize flex-1 transition-colors" style={{ color: isA ? c : isD ? "#fff" : "rgba(255,255,255,.3)" }}>{n}</span>
                {isA && <span className="text-[10px] text-white/60 animate-spin">◌</span>}
                {isD && !isA && <span className="text-[10px] text-emerald-400">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-b border-white/[0.06]">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 mb-3">Session</div>
        {[
          ["Runs", runCount || "—"],
          ["Mode", connected ? "Live" : "Demo"],
        ].map(([l, v]) => (
          <div key={String(l)} className="flex justify-between py-1.5 border-b border-white/[0.05] last:border-b-0">
            <span className="font-mono text-[10px] text-white/30">{l}</span>
            <span className={`font-mono text-[11px] font-medium ${String(v) === "Live" ? "text-emerald-300" : String(v) === "Demo" ? "text-yellow-300" : "text-white"}`}>{String(v)}</span>
          </div>
        ))}
      </div>

      <div className="p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35 mb-3">Token usage</div>
        {[
          ["Total", usage.total_tokens || "—"],
          ["Prompt", usage.prompt_tokens || "—"],
          ["Completion", usage.completion_tokens || "—"],
          ["Est. cost", usage.estimated_cost_usd ? `$${usage.estimated_cost_usd.toFixed(5)}` : "—"],
        ].map(([l, v]) => (
          <div key={String(l)} className="flex justify-between py-1.5 border-b border-white/[0.05] last:border-b-0">
            <span className="font-mono text-[10px] text-white/30">{l}</span>
            <span className="font-mono text-[11px] text-white font-medium">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section id="terminal" className={fullscreen ? "fixed inset-0 z-[100] bg-[#050505]" : "relative bg-[#050505] py-24 md:py-32 px-5 md:px-10 border-t border-white/[0.05]"}>
      {!fullscreen && (
        <div className="max-w-7xl mx-auto mb-10">
          <SLabel text="Agent terminal" color="#06B6D4" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="font-display font-extrabold tracking-tighter text-white text-[clamp(40px,7vw,84px)] leading-[0.9]">
              Talk to the<br /><span style={{ WebkitTextStroke: "1px rgba(255,255,255,0.22)", WebkitTextFillColor: "transparent" }}>system.</span>
            </motion.h2>
            <button onClick={() => setPanelOpen(!panelOpen)} className="md:hidden font-mono text-[10px] uppercase tracking-[0.12em] px-3 py-2 rounded-md border border-white/10 text-white/60 hover:text-white">
              {panelOpen ? "Hide panel" : "Show panel"}
            </button>
          </div>
        </div>
      )}

      <div className={fullscreen ? "h-full" : "max-w-7xl mx-auto"}>
        <motion.div layout className={`${fullscreen ? "h-full rounded-none border-0" : "rounded-2xl border border-white/[0.07]"} bg-[#0A0A0A] overflow-hidden glow`}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-black/60 backdrop-blur-sm">
            <button onClick={() => setFullscreen(false)} className="group w-3 h-3 rounded-full bg-[#FF5F57] flex items-center justify-center"><X className="w-2 h-2 text-black/0 group-hover:text-black/70" /></button>
            <button onClick={() => setMinimized(!minimized)} className="group w-3 h-3 rounded-full bg-[#FFBD2E] flex items-center justify-center"><Minimize2 className="w-2 h-2 text-black/0 group-hover:text-black/70" /></button>
            <button onClick={() => setFullscreen(!fullscreen)} className="group w-3 h-3 rounded-full bg-[#28CA41] flex items-center justify-center"><Maximize2 className="w-2 h-2 text-black/0 group-hover:text-black/70" /></button>
            <span className="font-mono text-[10px] text-white/40 ml-2">agentflow ─ zsh</span>
            {streaming && (
              <span className="flex items-center gap-1.5 ml-3 font-mono text-[10px] text-cyan-300">
                <span className="animate-spin">◌</span>{activeNode || "running"}
              </span>
            )}
            {connected && !streaming && token && (
              <span className="flex items-center gap-1.5 ml-3 font-mono text-[10px] text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />live
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {msgs.length > 0 && !streaming && (
                <button onClick={clearMsgs} className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-md border border-white/10 text-white/40 hover:text-white hover:border-white/25 transition">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
              {streaming && (
                <button onClick={stop} className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 transition">
                  <Square className="w-2.5 h-2.5 fill-current" /> Stop
                </button>
              )}
              <button onClick={() => setFullscreen(!fullscreen)} className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-md border border-white/10 text-white/55 hover:text-white hover:border-white/25 transition">
                {fullscreen ? <><Minimize2 className="w-3 h-3" /> Exit</> : <><Maximize2 className="w-3 h-3" /> Expand</>}
              </button>
              <button onClick={() => setMinimized(!minimized)} className="hidden sm:flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-md border border-white/10 text-white/55 hover:text-white hover:border-white/25 transition">
                {minimized ? "Expand" : "Minimize"}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {!minimized && (
              <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className={fullscreen ? "h-[calc(100%-44px)] grid md:grid-cols-[1fr_280px]" : "grid md:grid-cols-[1fr_280px]"}>
                <div className="flex flex-col bg-[#050505] min-w-0">
                  <div ref={msgsRef} className={`flex-1 overflow-y-auto p-5 space-y-3 ${fullscreen ? "" : "min-h-[340px] max-h-[480px]"}`}>
                    {msgs.length === 0 && (
                      <div className="space-y-4">
                        <div className="font-mono text-[12.5px] text-white/40 leading-loose">
                          <span className="text-cyan-300">AgentFlow OS</span> v1.0.0 — ready.
                          <br />
                          <span className="opacity-70">
                            {token
                              ? connected
                                ? "✓ Live backend connected. Type a goal to run real agents."
                                : "⚠ Demo mode active. Type a goal to see a simulation."
                              : "Enter your email to connect."}
                          </span>
                        </div>
                        {token && (
                          <div className="space-y-2">
                            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/25 mb-2">Suggested goals:</div>
                            {SUGGESTIONS.map((s) => (
                              <button key={s} onClick={() => send(s)} className="block w-full text-left px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all font-mono text-[11px] text-white/50 hover:text-white/80">
                                → {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <AnimatePresence>
                      {msgs.map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                          className="rounded-lg px-3.5 py-3 border"
                          style={{
                            background: m.role === "user" ? "rgba(6,182,212,.06)" : m.node === "system" ? "rgba(255,255,255,.02)" : "#0A0A0A",
                            borderColor: m.role === "user" ? "rgba(6,182,212,.25)" : m.node === "system" ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.06)",
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            {m.role === "user" && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-400/80">you</span>}
                            {m.role === "agent" && m.node && m.node !== "system" && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: AGENT_COLORS[m.node] || "#94A3B8" }} />
                                <span className="font-mono text-[9px] uppercase tracking-[0.14em]" style={{ color: AGENT_COLORS[m.node] || "#94A3B8" }}>{m.node}</span>
                              </div>
                            )}
                            {m.role === "agent" && m.node === "system" && <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/25">system</span>}
                            {m.ts && <span className="font-mono text-[9px] text-white/20">{m.ts}</span>}
                          </div>
                          <div className={`${m.role === "user" ? "font-body text-[14px] text-white" : "font-mono text-[12px] text-white/70"} leading-relaxed whitespace-pre-wrap break-words`}>
                            {m.content}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {streaming && (
                      <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg border border-white/[0.06] bg-[#0A0A0A]">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span key={i} className="w-1 h-1 rounded-full bg-cyan-300" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, delay: i * 0.12, repeat: Infinity }} />
                          ))}
                        </div>
                        <span className="font-mono text-[11px] text-white/40">{activeNode ? `${activeNode} is working…` : "Processing…"}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-white/[0.06] bg-black/30 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && send()}
                        placeholder={token ? connected ? "Type a goal… (live agents)" : "Type a goal… (demo mode)" : "Connect first →"}
                        disabled={!token || streaming}
                        className="flex-1 min-w-0 bg-[#0A0A0A] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-white text-[13px] font-mono outline-none focus:border-cyan-400/40 transition disabled:opacity-60"
                      />
                      <button onClick={() => send()} disabled={!token || !goal.trim() || streaming} className="flex-shrink-0 w-11 h-11 rounded-lg bg-white text-black flex items-center justify-center disabled:opacity-30 hover:scale-105 transition-transform">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    {token && !connected && (
                      <div className="font-mono text-[9px] text-yellow-400/50">⚠ Demo mode — responses are simulated, not from real agents</div>
                    )}
                  </div>
                </div>
                <div className={`${panelOpen ? "block" : "hidden"} md:block border-t md:border-t-0 border-white/[0.06]`}>
                  {SidePanel}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

const DOC_SECTIONS = [
  { t: "What is AgentFlow OS?", c: "AgentFlow OS is a production-grade autonomous multi-agent system. You give it a goal — it plans, delegates to specialist workers, self-heals errors, reviews quality, and returns a polished answer. Built on LangGraph + LangChain + Groq." },
  { t: "How the pipeline works", c: "The Supervisor node (LangGraph) receives your goal and decomposes it into subtasks. Each subtask is routed to the right worker: Researcher for information gathering, Coder for writing and executing Python, Analyst for data tasks. After all workers complete, the Critic scores quality 0–1. Below 0.7 triggers a full retry with re-planning. Above 0.7, the Writer synthesises everything into a final response." },
  { t: "Getting started", c: "1. Visit agentflow-os-mu.vercel.app\n2. Scroll to the terminal section\n3. Enter any email to connect\n4. Type a goal and press Enter\n5. Watch the agents work in real-time" },
  { t: "API reference", c: "POST /api/auth/token — Get a JWT token (dev mode, any email)\nPOST /api/runs — Run a task synchronously\nGET /api/runs/stream?goal=... — SSE streaming endpoint\nGET /api/runs/{run_id} — Get run state\nGET /health — Health check" },
  { t: "Environment variables", c: "GROQ_API_KEY — Your Groq API key (free at console.groq.com)\nTAVILY_API_KEY — Web search key (free at tavily.com)\nLANGCHAIN_API_KEY — LangSmith tracing (optional)\nJWT_SECRET_KEY — Sign tokens (use openssl rand -hex 32 in prod)" },
  { t: "Self-healing Coder", c: "The Coder agent is the most impressive part. It writes Python → executes it in a sandboxed subprocess → reads stderr → sends code + error back to Groq to fix → retries. Up to 4 fix attempts before escalating to the Critic." },
];

function Docs({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-[#050505] pt-28 pb-24 px-5 md:px-10">
      <div className="max-w-3xl mx-auto">
        <button onClick={onBack} className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] px-3 py-2 rounded-md border border-white/10 text-white/55 hover:text-white hover:border-white/25 mb-12 transition">
          <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Back
        </button>
        <SLabel text="Documentation" color="#06B6D4" />
        <h1 className="font-display font-extrabold tracking-tighter text-white text-[clamp(48px,8vw,96px)] leading-[0.9] mb-14">
          AgentFlow OS<br /><span className="text-white/25">Docs</span>
        </h1>
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden divide-y divide-white/[0.05]">
          {DOC_SECTIONS.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.04 }} className={`p-7 ${i % 2 === 0 ? "bg-[#0A0A0A]" : "bg-[#0D0D0D]"}`}>
              <h3 className="font-display font-bold text-xl text-cyan-300 mb-3">{s.t}</h3>
              <p className={`text-white/55 leading-relaxed whitespace-pre-line ${s.c.includes("\n") ? "font-mono text-[12.5px]" : "font-body text-[14.5px]"}`}>{s.c}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="relative bg-black border-t border-white/[0.05] overflow-hidden">
      <div className="py-12 px-5 md:px-10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md border border-white/10 bg-white/[0.04] flex items-center justify-center font-mono text-[10px] text-white/60">AF</div>
            <span className="font-display font-bold text-white/80">AgentFlow OS</span>
          </div>
          <div className="flex flex-wrap gap-5">
            {["LangGraph", "LangChain", "Groq", "FastAPI", "React 18"].map((x) => (
              <span key={x} className="font-mono text-[10px] tracking-[0.06em] text-white/25">{x}</span>
            ))}
          </div>
          <span className="font-mono text-[10px] text-white/20">Built for the future of AI</span>
        </div>
      </div>
      <div className="overflow-hidden border-t border-white/[0.04] py-6">
        <div className="flex w-max ticker">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="font-display font-extrabold text-[clamp(60px,10vw,140px)] tracking-tighter text-white/[0.04] px-8 whitespace-nowrap">AGENTFLOW · OS ·</span>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const goTerm = () => {
    if (page !== "home") setPage("home");
    setTimeout(() => { document.getElementById("terminal")?.scrollIntoView({ behavior: "smooth" }); }, 50);
  };
  if (page === "docs") {
    return (
      <div className="relative">
        <div className="grain" />
        <Nav onLaunch={goTerm} onDocs={() => setPage("home")} />
        <Docs onBack={() => { setPage("home"); window.scrollTo(0, 0); }} />
        <Footer />
      </div>
    );
  }
  return (
    <div className="relative bg-[#050505] overflow-x-hidden">
      <div className="grain" />
      <Nav onLaunch={goTerm} onDocs={() => { setPage("docs"); window.scrollTo(0, 0); }} />
      <Hero onLaunch={goTerm} />
      <Ticker />
      <HowItWorks />
      <AgentsSection />
      <StackSection />
      <Terminal />
      <Footer />
    </div>
  );
}