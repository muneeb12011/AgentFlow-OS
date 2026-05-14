import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'

interface Message { role: 'user' | 'agent'; content: string; node?: string }
interface TokenUsage { total_tokens: number; prompt_tokens: number; completion_tokens: number; estimated_cost_usd: number }

/* ── Design tokens ── */
const C = {
  bg:      '#080706',
  surf:    '#0F0E0C',
  surf2:   '#141210',
  bord:    'rgba(255,255,255,.06)',
  bord2:   'rgba(255,255,255,.1)',
  fg:      '#F0EBE1',
  fg2:     'rgba(240,235,225,.5)',
  fg3:     'rgba(240,235,225,.2)',
  fg4:     'rgba(240,235,225,.08)',
  gold:    '#C9AA71',
  goldDim: 'rgba(201,170,113,.12)',
  goldGlow:'rgba(201,170,113,.06)',
  teal:    '#7AABA0',
  rose:    '#C87A8A',
  sage:    '#A8B87A',
  amber:   '#C89A7A',
  violet:  '#8A8AB8',
}

const AGENT_COLORS: Record<string, string> = {
  supervisor: C.gold, researcher: C.teal,
  coder: C.rose, analyst: C.sage,
  critic: C.amber, writer: C.violet,
}

const PIPE = ['supervisor','researcher','coder','analyst','critic','writer']

const STEPS = [
  { n:'01', ico:'◎', t:'Set a Goal', d:'Type anything natural. The system understands intent and decomposes it into structured subtasks automatically.' },
  { n:'02', ico:'⑁', t:'Supervisor Plans', d:"LangGraph's Supervisor node breaks your goal into subtasks and assigns each to the right specialist agent." },
  { n:'03', ico:'⚡', t:'Agents Execute', d:'Workers run in sequence — researcher, coder, analyst — each output feeding into the next node in the graph.' },
  { n:'04', ico:'◈', t:'Critic Reviews', d:'Scores output quality 0–1. Below 0.7 triggers a full retry with supervisor re-planning. Quality is enforced.' },
  { n:'05', ico:'◇', t:'Writer Delivers', d:'Synthesises all outputs into one polished, cited, professional final response.' },
]

const AGENTS = [
  { n:'Supervisor', c: C.gold,   d:'Plans, routes, re-plans on failure. The orchestration brain using LangGraph conditional edges.', tags:['LangGraph','StateGraph','Re-planning'] },
  { n:'Researcher', c: C.teal,   d:'Searches Tavily, Wikipedia and ArXiv in an agentic bind_tools() loop. Real-time data retrieval.', tags:['Tavily','Wikipedia','ArXiv'] },
  { n:'Coder',      c: C.rose,   d:'Writes Python → sandbox → reads error → fixes → retries. Up to 4 self-heal attempts per task.', tags:['subprocess','Self-heal','Sandbox'] },
  { n:'Analyst',    c: C.sage,   d:'SQL queries, pandas analysis, data interpretation. Handles all numerical reasoning and data tasks.', tags:['SQL','pandas','Data'] },
  { n:'Critic',     c: C.amber,  d:'Scores all output 0.0–1.0. Below 0.7 forces a full retry. Quality gate enforced on every single run.', tags:['Scoring','Retry','0.7 gate'] },
  { n:'Writer',     c: C.violet, d:'Synthesises all worker outputs into one polished, cited, coherent final response.', tags:['Synthesis','Citation','Final'] },
]

const STACK = [
  { cat:'Orchestration', items:['LangGraph 0.2','StateGraph','MemorySaver','Cond. edges'] },
  { cat:'Agents',        items:['LangChain','bind_tools()','Agentic loop','Tool registry'] },
  { cat:'LLM',           items:['Groq API','llama-3.3-70b','500+ tok/s','Cost tracking'] },
  { cat:'Backend',       items:['FastAPI','SSE streaming','JWT auth','Multi-tenancy'] },
  { cat:'Frontend',      items:['React 18','TypeScript','Framer Motion','Zustand'] },
  { cat:'Infra',         items:['Docker Compose','PostgreSQL','Redis','LangSmith'] },
]

const TICKS = ['Supervisor','Researcher','Coder','Analyst','Critic','Writer','LangGraph','LangChain','Groq LLM','FastAPI','TypeScript','Self-Healing','LangSmith','SSE Streaming','Multi-Tenant']

const DEMO: {node:string;content:string}[] = [
  { node:'supervisor', content:'Breaking down goal:\n1. Research LLM agent architectures\n2. Write Python executor demo\n3. Synthesise into final response' },
  { node:'researcher', content:'Searched Tavily + ArXiv:\n— ReAct (Yao et al. 2022): reasoning + acting\n— LangGraph: stateful DAGs for multi-agent\n— Groq: 500+ tok/s speculative decoding' },
  { node:'coder',      content:'Generated and executed:\n\n```python\nfrom langchain_groq import ChatGroq\nfrom langgraph.graph import StateGraph\nllm = ChatGroq(model="llama-3.3-70b")\ngraph = StateGraph(State)\n```\n\n✓ Executed. No errors.' },
  { node:'critic',     content:'Quality score: 0.91 ✓\nAccuracy ✓  Completeness ✓  Code validity ✓\nNo retry required — proceeding to writer.' },
  { node:'writer',     content:'LLM agents combine a language model with external tools in a plan-execute loop. LangGraph enables stateful multi-agent graphs where a Supervisor routes tasks to specialists, a Critic enforces quality (0.7 threshold), and a Writer synthesises the final answer — all autonomously.' },
]

/* ── Nav ── */
function Nav({ onLaunch, onDocs }: { onLaunch: () => void; onDocs: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      padding: '0 clamp(16px,5vw,64px)',
      background: scrolled ? `${C.bg}f0` : 'transparent',
      backdropFilter: scrolled ? 'blur(24px) saturate(160%)' : 'none',
      borderBottom: `1px solid ${scrolled ? C.bord : 'transparent'}`,
      transition: 'all .35s ease',
      height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, border: `1.5px solid ${C.gold}`,
          borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'DM Mono, monospace', fontSize: 9, color: C.gold,
          letterSpacing: '.06em', background: C.goldGlow,
        }}>AF</div>
        <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 17, letterSpacing: '.08em', color: C.fg }}>
          AGENTFLOW <span style={{ color: C.gold }}>OS</span>
        </span>
      </div>

      {/* Desktop nav */}
      <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {['Docs', 'Stack', 'Terminal'].map((label, i) => (
          <button key={label} onClick={i === 0 ? onDocs : i === 2 ? onLaunch : undefined}
            style={{
              fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em',
              textTransform: 'uppercase', background: 'transparent', color: C.fg2,
              border: 'none', padding: '8px 14px', cursor: 'pointer', borderRadius: 4,
              transition: 'color .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = C.gold)}
            onMouseLeave={e => (e.currentTarget.style.color = C.fg2)}>
            {label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: C.bord2 }} />
        <div style={{
          fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em',
          textTransform: 'uppercase', color: C.gold, border: `1px solid ${C.gold}40`,
          padding: '6px 12px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 5, height: 5, background: '#4ade80', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          Online
        </div>
        <button onClick={onLaunch} style={{
          fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.1em',
          textTransform: 'uppercase', background: C.gold, color: C.bg,
          border: 'none', borderRadius: 4, padding: '9px 18px', cursor: 'pointer',
          fontWeight: 700, transition: 'all .2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#dfc07e'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = C.gold; e.currentTarget.style.transform = '' }}>
          Launch ↗
        </button>
      </div>

      {/* Mobile hamburger */}
      <button className="nav-mobile" onClick={() => setMobileOpen(!mobileOpen)} style={{
        background: 'transparent', border: `1px solid ${C.bord2}`, borderRadius: 4,
        width: 38, height: 38, cursor: 'pointer', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 5, padding: 0,
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 18, height: 1.5, background: C.fg2, display: 'block', borderRadius: 1,
            transformOrigin: 'center',
            transform: mobileOpen ? (i === 0 ? 'rotate(45deg) translate(4px,4px)' : i === 2 ? 'rotate(-45deg) translate(4px,-4px)' : 'scaleX(0)') : 'none',
            transition: 'transform .25s, opacity .25s',
            opacity: mobileOpen && i === 1 ? 0 : 1,
          }} />
        ))}
      </button>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'absolute', top: 60, left: 0, right: 0,
              background: `${C.surf}f8`, backdropFilter: 'blur(24px)',
              borderBottom: `1px solid ${C.bord}`, padding: '16px 24px 20px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
            {[['Docs', onDocs], ['Terminal', onLaunch]].map(([label, fn]) => (
              <button key={String(label)} onClick={() => { (fn as () => void)(); setMobileOpen(false) }}
                style={{
                  fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.1em',
                  textTransform: 'uppercase', background: 'transparent', color: C.fg2,
                  border: 'none', padding: '12px 0', cursor: 'pointer', textAlign: 'left',
                  borderBottom: `1px solid ${C.bord}`,
                }}>
                {String(label)}
              </button>
            ))}
            <button onClick={() => { onLaunch(); setMobileOpen(false) }} style={{
              marginTop: 8, fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.1em',
              textTransform: 'uppercase', background: C.gold, color: C.bg, border: 'none',
              borderRadius: 4, padding: '12px', cursor: 'pointer', fontWeight: 700,
            }}>Open Terminal ↗</button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

/* ── Hero ── */
function Hero({ onLaunch }: { onLaunch: () => void }) {
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 80])
  const opacity = useTransform(scrollY, [0, 400], [1, 0])

  useEffect(() => { setTimeout(() => setMounted(true), 80) }, [])

  return (
    <section ref={ref} style={{
      minHeight: '100svh', position: 'relative', background: C.bg,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: '100px clamp(16px,5vw,64px) 60px',
      overflow: 'hidden',
    }}>
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${C.bord} 1px,transparent 1px),linear-gradient(90deg,${C.bord} 1px,transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
      {/* Glow orbs */}
      <div style={{
        position: 'absolute', top: '20%', left: '-5%', width: '55vw', height: '55vw',
        maxWidth: 700, maxHeight: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${C.goldGlow} 0%, transparent 65%)`,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '-10%', width: '40vw', height: '40vw',
        maxWidth: 500, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(122,171,160,.04) 0%, transparent 65%)`,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <motion.div style={{ y, opacity, position: 'relative', zIndex: 2, maxWidth: 780 }}>
        {/* Tag */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={mounted ? { opacity: 1, x: 0 } : {}} transition={{ duration: .7, ease: [.16,1,.3,1] }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <span style={{ width: 32, height: 1, background: C.gold, display: 'block' }} />
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: C.gold }}>
            LangGraph · LangChain · Groq
          </span>
        </motion.div>

        {/* Headline */}
        <div style={{ overflow: 'hidden', marginBottom: 10 }}>
          <motion.h1 initial={{ y: '100%' }} animate={mounted ? { y: 0 } : {}} transition={{ duration: .8, delay: .05, ease: [.16,1,.3,1] }}
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 'clamp(64px,13vw,160px)',
              lineHeight: .86, letterSpacing: '.02em', color: C.fg, margin: 0,
            }}>
            THE OS
          </motion.h1>
        </div>
        <div style={{ overflow: 'hidden', marginBottom: 10 }}>
          <motion.div initial={{ y: '100%' }} animate={mounted ? { y: 0 } : {}} transition={{ duration: .8, delay: .12, ease: [.16,1,.3,1] }}
            style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(8px,2vw,20px)', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(64px,13vw,160px)', lineHeight: .86, color: C.gold }}>FOR AI</span>
          </motion.div>
        </div>
        <div style={{ overflow: 'hidden', marginBottom: 36 }}>
          <motion.h1 initial={{ y: '100%' }} animate={mounted ? { y: 0 } : {}} transition={{ duration: .8, delay: .19, ease: [.16,1,.3,1] }}
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 'clamp(64px,13vw,160px)',
              lineHeight: .86, letterSpacing: '.02em',
              color: 'transparent', WebkitTextStroke: `1.5px ${C.fg3}`,
              margin: 0,
            }}>
            AGENTS
          </motion.h1>
        </div>

        {/* Sub + CTA */}
        <motion.p initial={{ opacity: 0, y: 16 }} animate={mounted ? { opacity: 1, y: 0 } : {}} transition={{ duration: .7, delay: .35, ease: [.16,1,.3,1] }}
          style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 'clamp(14px,1.6vw,17px)',
            color: C.fg2, lineHeight: 1.9, maxWidth: 440, fontWeight: 300,
            marginBottom: 40,
          }}>
          Give it a goal. It plans, researches, writes code, heals its own errors,
          and delivers a polished answer — completely autonomously.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={mounted ? { opacity: 1, y: 0 } : {}} transition={{ duration: .6, delay: .48 }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onLaunch} style={{
            fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.12em',
            textTransform: 'uppercase', background: C.gold, color: C.bg,
            border: 'none', borderRadius: 6, padding: 'clamp(12px,2vw,16px) clamp(20px,3vw,28px)',
            cursor: 'pointer', fontWeight: 700, transition: 'all .2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 32px ${C.gold}30` }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
            Open Terminal ↗
          </button>
          <button style={{
            fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '.12em',
            textTransform: 'uppercase', background: 'transparent', color: C.fg,
            border: `1px solid ${C.bord2}`, borderRadius: 6,
            padding: 'clamp(12px,2vw,16px) clamp(20px,3vw,28px)', cursor: 'pointer', transition: 'all .2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `${C.gold}60`; e.currentTarget.style.transform = 'translateY(-3px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.bord2; e.currentTarget.style.transform = '' }}>
            View Source ↗
          </button>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: .6 }}
        style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 1, height: 40, overflow: 'hidden', background: C.bord }}>
          <div style={{ width: 1, height: '100%', background: C.gold, animation: 'siDown 1.8s ease-in-out infinite' }} />
        </div>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 8, letterSpacing: '.2em', textTransform: 'uppercase', color: C.fg3 }}>scroll</span>
      </motion.div>
    </section>
  )
}

/* ── Ticker ── */
function Ticker() {
  const dbl = [...TICKS, ...TICKS, ...TICKS]
  return (
    <div style={{ overflow: 'hidden', background: C.gold, padding: '12px 0', position: 'relative' }}>
      <div style={{ display: 'flex', width: 'max-content', animation: 'tickRun 28s linear infinite' }}>
        {dbl.map((t, i) => (
          <span key={i} style={{
            fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.16em',
            textTransform: 'uppercase', color: 'rgba(8,7,6,.6)', padding: '0 24px', whiteSpace: 'nowrap',
          }}>
            {t} <span style={{ opacity: .3 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Section label ── */
function SLabel({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <span style={{ width: 28, height: 1.5, background: C.gold, display: 'block', flexShrink: 0, borderRadius: 1 }} />
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: C.gold }}>
        {text}
      </span>
    </div>
  )
}

/* ── How It Works ── */
function HowItWorks() {
  return (
    <section style={{ background: C.bg, padding: 'clamp(60px,8vw,110px) clamp(16px,5vw,64px)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -200, right: -200, width: 500, height: 500,
        borderRadius: '50%', border: `1px solid ${C.bord}`, pointerEvents: 'none',
      }} />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SLabel text="Five steps / zero intervention" />
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .7, ease: [.16,1,.3,1] }}
          style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(40px,7vw,80px)', letterSpacing: '.02em', lineHeight: .9, color: C.fg, marginBottom: 48 }}>
          From goal<br /><span style={{ color: C.fg3 }}>to answer.</span>
        </motion.h2>

        {/* Steps grid — stacks on mobile */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))',
          gap: 1, background: C.bord, border: `1px solid ${C.bord}`, borderRadius: 8, overflow: 'hidden',
        }}>
          {STEPS.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: .5, delay: i * .06, ease: [.16,1,.3,1] }}
              style={{ padding: 'clamp(20px,3vw,28px)', background: C.bg, cursor: 'default' }}
              whileHover={{ backgroundColor: C.surf }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.14em', color: C.fg3, marginBottom: 20 }}>{s.n}</div>
              <div style={{
                width: 42, height: 42, border: `1px solid ${C.gold}35`, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: C.gold, background: C.goldGlow, marginBottom: 18,
              }}>{s.ico}</div>
              <div style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, color: C.fg, marginBottom: 8 }}>{s.t}</div>
              <div style={{ fontSize: 12.5, color: C.fg2, lineHeight: 1.85, fontWeight: 300, fontFamily: 'DM Sans, sans-serif' }}>{s.d}</div>
            </motion.div>
          ))}
        </div>

        {/* Pipeline flow */}
        <div style={{
          marginTop: 1, background: C.surf, borderRadius: '0 0 8px 8px',
          border: `1px solid ${C.bord}`, borderTop: 'none',
          padding: '16px clamp(12px,2vw,20px)',
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, overflowX: 'auto',
        }}>
          {PIPE.map((n, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{
                fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.08em',
                textTransform: 'uppercase', padding: '6px 12px',
                border: `1px solid ${AGENT_COLORS[n]}35`, borderRadius: 4,
                color: AGENT_COLORS[n], background: `${AGENT_COLORS[n]}0d`,
                display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.2,
              }}>
                <span>{n}</span>
                <span style={{ fontSize: 8, opacity: .55 }}>{n==='critic'?'0.7 gate':n==='writer'?'final':'worker'}</span>
              </div>
              {i < PIPE.length - 1 && <span style={{ color: C.fg3, fontSize: 12, flexShrink: 0 }}>→</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Agents ── */
function Agents() {
  return (
    <section style={{ background: C.surf, padding: 'clamp(60px,8vw,110px) clamp(16px,5vw,64px)', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${C.fg4} 1px,transparent 1px),linear-gradient(90deg,${C.fg4} 1px,transparent 1px)`,
        backgroundSize: '60px 60px', pointerEvents: 'none',
      }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <SLabel text="The specialists" />
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .7, ease: [.16,1,.3,1] }}
          style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(40px,7vw,80px)', letterSpacing: '.02em', lineHeight: .9, color: C.fg, marginBottom: 48 }}>
          Six agents.<br /><span style={{ color: C.fg3 }}>One mission.</span>
        </motion.h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,280px),1fr))',
          gap: 1, background: C.bord, borderRadius: 8, overflow: 'hidden',
        }}>
          {AGENTS.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: .5, delay: i * .06, ease: [.16,1,.3,1] }} viewport={{ once: true, margin: '-20px' }}
              style={{ padding: 'clamp(20px,3vw,28px)', background: C.surf, position: 'relative', cursor: 'default' }}
              whileHover={{ backgroundColor: C.surf2 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: a.c, borderRadius: '0 0 2px 2px' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 8, border: `1px solid ${a.c}35`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Bebas Neue, sans-serif', fontSize: 18, color: a.c,
                  background: `${a.c}0d`, flexShrink: 0,
                }}>{a.n[0]}</div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: C.fg3, letterSpacing: '.1em' }}>0{i + 1}</span>
              </div>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: '.04em', color: C.fg, marginBottom: 8 }}>{a.n.toUpperCase()}</div>
              <div style={{ fontSize: 13, color: C.fg2, lineHeight: 1.85, marginBottom: 18, fontWeight: 300, fontFamily: 'DM Sans, sans-serif' }}>{a.d}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {a.tags.map(tag => (
                  <span key={tag} style={{
                    fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.05em',
                    textTransform: 'uppercase', padding: '3px 8px', borderRadius: 3,
                    border: `1px solid ${a.c}28`, color: a.c, background: `${a.c}0a`,
                  }}>{tag}</span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Stack ── */
function Stack() {
  return (
    <section style={{ background: C.bg, padding: 'clamp(60px,8vw,110px) clamp(16px,5vw,64px)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SLabel text="Tech stack" />
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .7, ease: [.16,1,.3,1] }}
          style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(40px,7vw,80px)', letterSpacing: '.02em', lineHeight: .9, color: C.fg, marginBottom: 48 }}>
          Built with<br /><span style={{ color: C.gold }}>precision.</span>
        </motion.h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,160px),1fr))',
          gap: 1, background: C.bord, borderRadius: 8, overflow: 'hidden',
        }}>
          {STACK.map((col, ci) => (
            <div key={ci} style={{ padding: 'clamp(18px,3vw,26px)', background: C.bg, transition: 'background .2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surf)}
              onMouseLeave={e => (e.currentTarget.style.background = C.bg)}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: C.gold, marginBottom: 16 }}>{col.cat}</div>
              {col.items.map((item, ii) => (
                <motion.div key={ii} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: .3, delay: ii * .05 }} viewport={{ once: true }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.bord}` }}
                  whileHover={{ x: 3 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: C.gold, opacity: .5, flexShrink: 0 }}>›</span>
                  <span style={{ fontSize: 12.5, color: C.fg, fontFamily: 'DM Sans, sans-serif' }}>{item}</span>
                </motion.div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Stats Banner ── */
function StatsBanner() {
  const stats = [
    { v: '6', l: 'Specialist agents' },
    { v: '500+', l: 'Tokens per second' },
    { v: '0.7', l: 'Quality threshold' },
    { v: '4x', l: 'Self-heal attempts' },
  ]
  return (
    <section style={{
      background: C.surf, borderTop: `1px solid ${C.bord}`, borderBottom: `1px solid ${C.bord}`,
      padding: 'clamp(32px,5vw,56px) clamp(16px,5vw,64px)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))', gap: 2,
      }}>
        {stats.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: .5, delay: i * .07 }}
            style={{ textAlign: 'center', padding: 'clamp(16px,2vw,24px)' }}>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(44px,6vw,64px)', color: C.gold, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: C.fg2, marginTop: 8 }}>{s.l}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ── Terminal ── */
function Terminal() {
  const [tok, setTok] = useState('')
  const [em, setEm] = useState('')
  const [logging, setLogging] = useState(false)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [goal, setGoal] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [an, setAn] = useState('')
  const [done, setDone] = useState<Set<string>>(new Set())
  const [usage, setUsage] = useState<TokenUsage>({ total_tokens: 0, prompt_tokens: 0, completion_tokens: 0, estimated_cost_usd: 0 })
  const [showPanel, setShowPanel] = useState(false)
  const msgsEl = useRef<HTMLDivElement>(null)

  useEffect(() => { msgsEl.current?.scrollTo({ top: 99999, behavior: 'smooth' }) }, [msgs, streaming])

  const login = useCallback(async () => {
    setLogging(true)
    try {
      const r = await fetch('/api/auth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em || 'user@agentflow.ai', tenant_id: 'default' }) })
      const d = await r.json(); setTok(d.access_token)
    } catch { setTok('demo-' + Date.now()) }
    setLogging(false)
  }, [em])

  const runDemo = useCallback(async () => {
    for (const d of DEMO) {
      setAn(d.node); await new Promise(r => setTimeout(r, 1300))
      setMsgs(p => [...p, { role: 'agent', content: d.content, node: d.node }])
      setDone(p => new Set([...p, d.node])); setAn('')
    }
    setUsage({ total_tokens: 4821, prompt_tokens: 3200, completion_tokens: 1621, estimated_cost_usd: 0.00482 })
  }, [])

  const send = useCallback(async () => {
    const g = goal.trim(); if (!g || streaming) return
    setGoal(''); setStreaming(true); setDone(new Set()); setAn('')
    setMsgs(p => [...p, { role: 'user', content: g }])
    try {
      const r = await fetch('/api/runs/stream?goal=' + encodeURIComponent(g), { headers: { 'Authorization': `Bearer ${tok}` } })
      if (!r.ok || !r.body) throw 0
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done: d, value: v } = await reader.read(); if (d) break
        buf += dec.decode(v, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop()!
        for (const l of lines) {
          if (!l.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(l.slice(6))
            if (ev.node) setAn(ev.node)
            if (ev.messages) for (const m of ev.messages) if (m.content) { setMsgs(p => [...p, { role: 'agent', content: m.content, node: ev.node }]); setDone(p => new Set([...p, ev.node])) }
            if (ev.token_usage) setUsage(ev.token_usage)
            if (ev.answer) { setMsgs(p => [...p, { role: 'agent', content: ev.answer, node: 'writer' }]); setDone(p => new Set([...p, 'writer'])) }
          } catch { }
        }
      }
    } catch { await runDemo() }
    setStreaming(false); setAn('')
  }, [goal, streaming, tok, runDemo])

  return (
    <section id="terminal-sec" style={{ background: C.surf, padding: 'clamp(60px,8vw,110px) clamp(16px,5vw,64px)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SLabel text="Agent terminal" />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .7, ease: [.16,1,.3,1] }}
            style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(40px,7vw,80px)', letterSpacing: '.02em', lineHeight: .9, color: C.fg }}>
            Talk to the<br /><span style={{ color: C.fg3 }}>system.</span>
          </motion.h2>
          <button onClick={() => setShowPanel(!showPanel)} className="panel-toggle"
            style={{
              fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.1em',
              textTransform: 'uppercase', background: 'transparent', color: C.fg2,
              border: `1px solid ${C.bord2}`, borderRadius: 4, padding: '8px 14px', cursor: 'pointer',
            }}>
            {showPanel ? 'Hide panel ×' : 'Show panel ≡'}
          </button>
        </div>

        {/* Terminal layout */}
        <div className="term-grid" style={{
          display: 'grid', gridTemplateColumns: '1fr 260px',
          gap: 1, background: C.bord, borderRadius: 10, overflow: 'hidden',
          border: `1px solid ${C.bord}`, boxShadow: `0 24px 80px rgba(0,0,0,.5), 0 0 0 1px ${C.bord}`,
        }}>
          {/* Main pane */}
          <div style={{ background: C.bg, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Titlebar */}
            <div style={{
              padding: '10px 16px', borderBottom: `1px solid ${C.bord}`,
              display: 'flex', alignItems: 'center', gap: 7, background: C.surf,
              flexShrink: 0,
            }}>
              {[['#ff5f57','close'],['#febc2e','min'],['#28c840','max']].map(([col, label]) => (
                <div key={label} title={label} style={{ width: 11, height: 11, borderRadius: '50%', background: col, cursor: 'pointer' }} />
              ))}
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: C.fg3, marginLeft: 6 }}>agentflow — zsh</span>
              {streaming && an && (
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Mono, monospace', fontSize: 10, color: C.gold }}>
                  <span style={{ animation: 'spin .7s linear infinite', display: 'inline-block' }}>◌</span>
                  {an}
                </span>
              )}
            </div>

            {/* Messages */}
            <div ref={msgsEl} style={{ flex: 1, minHeight: 300, maxHeight: 400, overflowY: 'auto', padding: 'clamp(12px,2vw,20px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {msgs.length === 0 && (
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: C.fg3, lineHeight: 2.2 }}>
                  <span style={{ color: C.gold }}>AgentFlow OS</span> v1.0 — ready.<br />
                  <span style={{ opacity: .6 }}>{tok ? 'Type a goal below.' : 'Connect to get started.'}</span><br />
                  <span style={{ opacity: .35 }}>Try: "Research LLM agents and write a demo"</span>
                </div>
              )}
              <AnimatePresence>
                {msgs.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}
                    style={{
                      padding: 'clamp(10px,2vw,14px)', borderRadius: 6,
                      background: m.role === 'user' ? C.goldGlow : C.surf,
                      border: `1px solid ${m.role === 'user' ? `${C.gold}22` : C.bord}`,
                    }}>
                    {m.role === 'agent' && m.node && (
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: AGENT_COLORS[m.node] || C.fg3, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: AGENT_COLORS[m.node] || C.fg3, display: 'inline-block' }} />
                        {m.node}
                      </div>
                    )}
                    <div style={{
                      fontFamily: m.role === 'user' ? 'DM Sans, sans-serif' : 'DM Mono, monospace',
                      fontSize: m.role === 'user' ? 14 : 12,
                      color: m.role === 'user' ? C.fg : 'rgba(240,235,225,.65)',
                      lineHeight: 1.85, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>{m.content}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {streaming && (
                <div style={{ display: 'flex', gap: 5, padding: '6px 4px' }}>
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: C.gold }}
                      animate={{ y: [0, -6, 0] }} transition={{ duration: .5, delay: i * .12, repeat: Infinity }} />
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: 'clamp(10px,2vw,14px)', borderTop: `1px solid ${C.bord}`, display: 'flex', gap: 8, flexShrink: 0 }}>
              <input value={goal} onChange={e => setGoal(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={tok ? 'Type a goal… (Enter to run)' : 'Connect first →'}
                disabled={!tok || streaming}
                style={{
                  flex: 1, background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 6,
                  padding: '10px 14px', color: C.fg, fontFamily: 'DM Mono, monospace', fontSize: 12,
                  outline: 'none', transition: 'border-color .2s', minWidth: 0,
                }}
                onFocus={e => (e.target.style.borderColor = `${C.gold}50`)}
                onBlur={e => (e.target.style.borderColor = C.bord)} />
              <button onClick={send} disabled={!tok || !goal.trim() || streaming}
                style={{
                  background: C.gold, border: 'none', borderRadius: 6, width: 42, height: 42,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: 14, color: C.bg, flexShrink: 0,
                  opacity: (!tok || !goal.trim() || streaming) ? .35 : 1, transition: 'opacity .2s, transform .15s',
                }}
                onMouseEnter={e => { if (!streaming) e.currentTarget.style.transform = 'scale(1.06)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = '' }}>▶</button>
            </div>
          </div>

          {/* Side panel */}
          <div className="term-side" style={{ background: C.surf, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${C.bord}` }}>
            {/* Auth */}
            <div style={{ padding: 16, borderBottom: `1px solid ${C.bord}` }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.fg3, marginBottom: 12 }}>Connection</div>
              {!tok ? (
                <>
                  <input value={em} onChange={e => setEm(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="your@email.com"
                    style={{
                      background: C.bg, border: `1px solid ${C.bord}`, borderRadius: 5,
                      padding: '8px 11px', color: C.fg, fontFamily: 'DM Mono, monospace', fontSize: 11,
                      outline: 'none', width: '100%', marginBottom: 8, boxSizing: 'border-box', transition: 'border-color .2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = `${C.gold}50`)}
                    onBlur={e => (e.target.style.borderColor = C.bord)} />
                  <button onClick={login} disabled={logging} style={{
                    width: '100%', background: C.gold, border: 'none', borderRadius: 5,
                    padding: '10px', fontFamily: 'DM Mono, monospace', fontWeight: 700,
                    fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase',
                    cursor: 'pointer', color: C.bg, opacity: logging ? .5 : 1, transition: 'opacity .2s',
                  }}>{logging ? 'Connecting…' : 'Get token'}</button>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: C.fg3, marginTop: 8 }}>Dev mode — any email works</div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4ade80' }}>● Connected</span>
                  <button onClick={() => setTok('')} style={{ background: 'none', border: 'none', color: C.fg3, cursor: 'pointer', fontSize: 14, marginLeft: 'auto', lineHeight: 1 }}>✕</button>
                </div>
              )}
            </div>

            {/* Pipeline */}
            <div style={{ padding: 16, borderBottom: `1px solid ${C.bord}` }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.fg3, marginBottom: 12 }}>Pipeline</div>
              {PIPE.map(n => {
                const isActive = an === n, isDone = done.has(n), col = AGENT_COLORS[n]
                return (
                  <div key={n} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 5, marginBottom: 3,
                    border: `1px solid ${isActive ? col + '35' : 'transparent'}`,
                    background: isActive ? `${col}0d` : 'transparent',
                    transition: 'all .2s',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: isActive ? col : isDone ? 'rgba(74,222,128,.6)' : C.fg4,
                      boxShadow: isActive ? `0 0 8px ${col}` : 'none',
                      transition: 'all .2s',
                    }} />
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, textTransform: 'capitalize', flex: 1, color: isActive ? col : isDone ? C.fg : C.fg3, transition: 'color .2s' }}>{n}</span>
                    {isActive && <span style={{ fontSize: 10, animation: 'spin .7s linear infinite', display: 'inline-block', color: col }}>◌</span>}
                    {isDone && !isActive && <span style={{ fontSize: 10, color: '#4ade80' }}>✓</span>}
                  </div>
                )
              })}
            </div>

            {/* Token usage */}
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.fg3, marginBottom: 12 }}>Token Usage</div>
              {[['Total', usage.total_tokens || '—'], ['Prompt', usage.prompt_tokens || '—'], ['Completion', usage.completion_tokens || '—'], ['Est. cost', usage.estimated_cost_usd ? `$${usage.estimated_cost_usd.toFixed(5)}` : '—']].map(([l, v]) => (
                <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.bord}` }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: C.fg3 }}>{l}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: C.fg, fontWeight: 500 }}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile panel toggle */}
        <AnimatePresence>
          {showPanel && (
            <motion.div className="term-side-mob" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', marginTop: 1, background: C.surf, borderRadius: '0 0 10px 10px', border: `1px solid ${C.bord}`, borderTop: 'none' }}>
              {/* Inline mini panel for mobile */}
              <div style={{ padding: 16, borderBottom: `1px solid ${C.bord}` }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.fg3, marginBottom: 12 }}>Pipeline Status</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PIPE.map(n => {
                    const isActive = an === n, isDone = done.has(n), col = AGENT_COLORS[n]
                    return (
                      <div key={n} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                        border: `1px solid ${isActive ? col + '40' : C.bord}`, borderRadius: 4,
                        background: isActive ? `${col}0d` : 'transparent',
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? col : isDone ? '#4ade80' : C.fg4 }} />
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, textTransform: 'capitalize', color: isActive ? col : isDone ? C.fg : C.fg3 }}>{n}</span>
                        {isDone && !isActive && <span style={{ fontSize: 9, color: '#4ade80' }}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
              {!tok ? (
                <div style={{ padding: 16 }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: C.fg3, marginBottom: 12 }}>Connect</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={em} onChange={e => setEm(e.target.value)} placeholder="your@email.com"
                      style={{ flex: 1, background: C.bg, border: `1px solid ${C.bord}`, borderRadius: 5, padding: '8px 11px', color: C.fg, fontFamily: 'DM Mono, monospace', fontSize: 11, outline: 'none', minWidth: 0 }} />
                    <button onClick={login} style={{ background: C.gold, border: 'none', borderRadius: 5, padding: '8px 14px', fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', color: C.bg, fontWeight: 700 }}>Go</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4ade80' }}>● Connected</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

/* ── Docs ── */
function Docs({ onBack }: { onBack: () => void }) {
  const sections = [
    { title: 'What is AgentFlow OS?', content: 'AgentFlow OS is a production-grade autonomous multi-agent system. You give it a goal — it plans, delegates to specialist workers, self-heals errors, reviews quality, and returns a polished answer. Built on LangGraph + LangChain + Groq.' },
    { title: 'How the pipeline works', content: 'The Supervisor node (LangGraph) receives your goal and decomposes it into subtasks. Each subtask is routed to the right worker: Researcher for information gathering, Coder for writing and executing Python, Analyst for data tasks. After all workers complete, the Critic scores quality 0–1. Below 0.7 triggers a full retry with re-planning. Above 0.7, the Writer synthesises everything into a final response.' },
    { title: 'Getting started', content: '1. Start the backend: uvicorn backend.main:app --reload --port 8000\n2. Start the frontend: npm run dev (inside /frontend)\n3. Open http://localhost:5173\n4. Scroll to the terminal section\n5. Enter any email to get a dev token\n6. Type a goal and press Enter' },
    { title: 'API reference', content: 'POST /api/auth/token — Get a JWT token (dev mode, any email)\nPOST /api/runs — Run a task synchronously\nGET /api/runs/stream?goal=... — SSE streaming endpoint\nGET /api/runs/{run_id} — Get run state\nGET /health — Health check' },
    { title: 'Environment variables', content: 'GROQ_API_KEY — Your Groq API key (free at console.groq.com)\nTAVILY_API_KEY — Web search key (free at tavily.com)\nLANGCHAIN_API_KEY — LangSmith tracing (optional)\nJWT_SECRET_KEY — Sign tokens (use openssl rand -hex 32 in prod)' },
    { title: 'Self-healing Coder', content: 'The Coder agent writes Python → executes it in a sandboxed subprocess → reads stderr → sends code + error back to Groq to fix → retries. Up to 4 fix attempts before escalating to the Critic. The entire fix loop runs inside the LangGraph node — no external routing needed.' },
    { title: 'Tech stack', content: 'Orchestration: LangGraph 0.2 (StateGraph, MemorySaver, conditional edges)\nAgents: LangChain (bind_tools, agentic loop, tool registry)\nLLM: Groq API — llama-3.3-70b-versatile (500+ tok/s)\nBackend: FastAPI, SSE streaming, JWT auth, multi-tenancy\nFrontend: React 18, TypeScript, Framer Motion\nInfra: Docker Compose, PostgreSQL, Redis, LangSmith' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(80px,12vw,120px) clamp(16px,5vw,40px) 80px' }}>
        <button onClick={onBack} style={{
          fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
          background: 'transparent', color: C.fg2, border: `1px solid ${C.bord2}`, borderRadius: 5,
          padding: '8px 14px', cursor: 'pointer', marginBottom: 48, display: 'flex', alignItems: 'center', gap: 8, transition: 'all .2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = `${C.gold}50` }}
          onMouseLeave={e => { e.currentTarget.style.color = C.fg2; e.currentTarget.style.borderColor = C.bord2 }}>
          ← Back to home
        </button>

        <SLabel text="Documentation" />
        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(52px,10vw,100px)', letterSpacing: '.02em', lineHeight: .88, color: C.fg, marginBottom: 56 }}>
          AgentFlow OS<br /><span style={{ color: C.fg3 }}>Docs</span>
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: `1px solid ${C.bord}`, borderRadius: 10, overflow: 'hidden' }}>
          {sections.map((s, i) => (
            <div key={i} style={{ padding: 'clamp(20px,4vw,32px)', background: i % 2 === 0 ? C.bg : C.surf, borderBottom: `1px solid ${C.bord}` }}>
              <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: '.04em', color: C.gold, marginBottom: 14 }}>{s.title}</h3>
              <p style={{ fontFamily: s.content.includes('\n') ? 'DM Mono, monospace' : 'DM Sans, sans-serif', fontSize: s.content.includes('\n') ? 12 : 14, color: C.fg2, lineHeight: 1.95, whiteSpace: 'pre-line', fontWeight: 300 }}>{s.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── CTA ── */
function CTA({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section style={{ background: C.bg, padding: 'clamp(60px,8vw,100px) clamp(16px,5vw,64px)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${C.goldGlow}, transparent)`, pointerEvents: 'none' }} />
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: .7 }}
        style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(44px,8vw,96px)', letterSpacing: '.02em', lineHeight: .9, color: C.fg, marginBottom: 20 }}>
          Ready to build<br /><span style={{ color: C.gold }}>the future?</span>
        </h2>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 'clamp(14px,1.5vw,16px)', color: C.fg2, lineHeight: 1.9, maxWidth: 420, margin: '0 auto 36px', fontWeight: 300 }}>
          Give the system a goal and watch six autonomous agents collaborate, reason, and deliver — instantly.
        </p>
        <button onClick={onLaunch} style={{
          fontFamily: 'DM Mono, monospace', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase',
          background: C.gold, color: C.bg, border: 'none', borderRadius: 8,
          padding: 'clamp(14px,2vw,18px) clamp(28px,4vw,44px)', cursor: 'pointer',
          fontWeight: 700, boxShadow: `0 0 40px ${C.gold}30`, transition: 'all .25s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 16px 48px ${C.gold}40` }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 0 40px ${C.gold}30` }}>
          Open Terminal ↗
        </button>
      </motion.div>
    </section>
  )
}

/* ── Footer ── */
function Footer() {
  return (
    <footer style={{ background: '#050403', borderTop: `1px solid ${C.bord}`, padding: 'clamp(20px,3vw,28px) clamp(16px,5vw,64px)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, border: `1px solid ${C.gold}30`, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono, monospace', fontSize: 8, color: `${C.gold}50`, background: C.goldGlow }}>AF</div>
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 13, letterSpacing: '.08em', color: C.fg3 }}>AGENTFLOW OS</span>
        </div>
        <div style={{ display: 'flex', gap: 'clamp(10px,2vw,22px)', flexWrap: 'wrap' }}>
          {['LangGraph', 'LangChain', 'Groq', 'FastAPI', 'React 18'].map(x => (
            <span key={x} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '.06em', color: C.fg3 }}>{x}</span>
          ))}
        </div>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: C.fg3, opacity: .5 }}>Built for the future of AI</span>
      </div>
    </footer>
  )
}

/* ── App ── */
export default function App() {
  const [page, setPage] = useState<'home' | 'docs'>('home')

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@300;400;500&display=swap'
    document.head.appendChild(link)
  }, [])

  const go = () => {
    document.getElementById('terminal-sec')?.scrollIntoView({ behavior: 'smooth' })
  }

  if (page === 'docs') return (
    <div style={{ background: C.bg }}>
      <Nav onLaunch={() => { setPage('home'); setTimeout(go, 100) }} onDocs={() => { setPage('home'); window.scrollTo(0, 0) }} />
      <Docs onBack={() => { setPage('home'); window.scrollTo(0, 0) }} />
      <Footer />
    </div>
  )

  return (
    <div style={{ background: C.bg, overflowX: 'hidden' }}>
      <Nav onLaunch={go} onDocs={() => { setPage('docs'); window.scrollTo(0, 0) }} />
      <Hero onLaunch={go} />
      <Ticker />
      <HowItWorks />
      <StatsBanner />
      <Agents />
      <Stack />
      <Terminal />
      <CTA onLaunch={go} />
      <Footer />

      <style>{`
        * { box-sizing: border-box; }
        body { overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        *::-webkit-scrollbar { width: 3px; height: 3px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: ${C.gold}; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }
        @keyframes tickRun { to { transform: translateX(-33.33%); } }
        @keyframes siDown { 0%{transform:translateY(-100%)} 50%{transform:translateY(0)} 100%{transform:translateY(100%)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .nav-desktop { display: flex; }
        .nav-mobile { display: none; }
        .term-side { display: flex; }
        .term-side-mob { display: none; }
        .panel-toggle { display: none; }
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile { display: flex !important; }
          .term-grid { grid-template-columns: 1fr !important; }
          .term-side { display: none !important; }
          .term-side-mob { display: block !important; }
          .panel-toggle { display: block !important; }
        }
      `}</style>
    </div>
  )
}