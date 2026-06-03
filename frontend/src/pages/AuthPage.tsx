import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, GitBranch, Search, Code2, ShieldCheck } from "lucide-react";
import { useAuth } from "../store/useAuth";

const API_URL = import.meta.env.VITE_API_URL || "https://muneeb01x-agentflow-os.hf.space";

interface AuthPageProps {
  onSuccess: () => void;
}

const FEATURES = [
  { icon: GitBranch, label: "LangGraph orchestration", desc: "6 specialized agents working in sequence" },
  { icon: Search, label: "Autonomous research", desc: "Tavily, Wikipedia, ArXiv search tools" },
  { icon: Code2, label: "Self-healing code", desc: "Writes, runs, fixes Python automatically" },
  { icon: ShieldCheck, label: "Quality critic", desc: "0.7 threshold gates every response" },
];

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async () => {
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password) { setError("Password is required."); return; }
    if (tab === "signup" && !name.trim()) { setError("Name is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = tab === "login" ? { email, password } : { email, password, name };

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Something went wrong."); return; }

      login(
        { user_id: data.user_id, email: data.email, name: data.name || email.split("@")[0], tenant_id: data.tenant_id || "default" },
        data.access_token
      );
      onSuccess();
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    alert("Google login coming soon! Use email/password for now.");
  };

  return (
    <div className="min-h-screen bg-[#080808] flex">

      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden bg-[#050505]">
        {/* Grid bg */}
        <div className="absolute inset-0 grid-bg opacity-40" />

        {/* Gradient orbs */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #06B6D4, transparent 65%)" }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, #8B5CF6, transparent 65%)" }} />

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
            <div className="absolute inset-1 rounded-lg grid-bg opacity-60" />
            <span className="relative font-mono text-[11px] font-bold text-white">AF</span>
          </div>
          <div>
            <div className="font-display font-extrabold text-[17px] tracking-tight text-white">AgentFlow OS</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/35">Multi-agent AI system</div>
          </div>
        </motion.div>

        {/* Hero text */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative space-y-6">
          <h1 className="font-display font-extrabold tracking-tighter text-white leading-[0.9] text-[clamp(42px,5vw,72px)]">
            The OS for<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400">
              AI agents
            </span><br />
            that ship.
          </h1>
          <p className="font-body text-white/45 text-[15px] leading-relaxed max-w-sm">
            Give it a goal. Six specialized agents plan, research, write code, fix errors, review quality, and deliver a polished answer — autonomously.
          </p>

          {/* Feature list */}
          <div className="space-y-3 pt-2">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-cyan-300" />
                  </div>
                  <div>
                    <div className="font-body text-[13px] text-white/80 font-medium">{f.label}</div>
                    <div className="font-mono text-[10px] text-white/35">{f.desc}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Bottom badges */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="relative flex flex-wrap gap-2">
          {["LangGraph", "Groq LLM", "FastAPI", "React 18"].map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-md border border-white/[0.08] bg-white/[0.03] font-mono text-[10px] text-white/35 uppercase tracking-[0.1em]">{t}</span>
          ))}
        </motion.div>
      </div>

      {/* ── Right panel — auth form ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <div className="absolute inset-0 bg-[#080808]" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center">
              <span className="font-mono text-[10px] font-bold text-white">AF</span>
            </div>
            <span className="font-display font-bold text-white text-[15px]">AgentFlow OS</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="font-display font-bold text-white text-[28px] tracking-tight mb-1.5">
              {tab === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="font-body text-white/40 text-[14px]">
              {tab === "login"
                ? "Sign in to your AgentFlow account"
                : "Start running autonomous agents today"}
            </p>
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/20 transition-all mb-5 group"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="font-body text-[14px] text-white/70 group-hover:text-white transition-colors">Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="font-mono text-[10px] text-white/25 uppercase tracking-[0.12em]">or</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07] mb-6">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2 rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] transition-all ${
                  tab === t
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "text-white/45 hover:text-white/70"
                }`}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: tab === "login" ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              {tab === "signup" && (
                <div className="space-y-1.5">
                  <label className="font-body text-[13px] text-white/60 font-medium">Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-[14px] font-body outline-none focus:border-cyan-400/60 focus:bg-white/[0.07] transition-all placeholder:text-white/25"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-body text-[13px] text-white/60 font-medium">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="you@example.com"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white text-[14px] font-body outline-none focus:border-cyan-400/60 focus:bg-white/[0.07] transition-all placeholder:text-white/25"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-body text-[13px] text-white/60 font-medium">Password</label>
                  {tab === "login" && (
                    <button className="font-body text-[12px] text-cyan-400/70 hover:text-cyan-300 transition-colors">Forgot password?</button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="Min. 6 characters"
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 pr-12 text-white text-[14px] font-body outline-none focus:border-cyan-400/60 focus:bg-white/[0.07] transition-all placeholder:text-white/25"
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors p-0.5"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/[0.08]"
                  >
                    <span className="text-red-400 text-[13px]">⚠</span>
                    <span className="font-body text-[13px] text-red-300">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-white/90 disabled:opacity-50 text-black font-body font-semibold text-[14px] py-3 rounded-xl transition-all hover:-translate-y-0.5 disabled:translate-y-0 mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Please wait…
                  </span>
                ) : (
                  <>
                    {tab === "login" ? "Sign In" : "Create Account"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Switch tab */}
              <p className="text-center font-body text-[13px] text-white/35 pt-1">
                {tab === "login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => { setTab(tab === "login" ? "signup" : "login"); setError(""); }}
                  className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  {tab === "login" ? "Sign up free" : "Sign in"}
                </button>
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Terms */}
          {tab === "signup" && (
            <p className="mt-5 text-center font-body text-[11px] text-white/20 leading-relaxed">
              By creating an account you agree to our{" "}
              <span className="text-white/40 cursor-pointer hover:text-white/60">Terms of Service</span>
              {" "}and{" "}
              <span className="text-white/40 cursor-pointer hover:text-white/60">Privacy Policy</span>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}