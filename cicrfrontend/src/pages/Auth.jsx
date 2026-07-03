import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  login, register, sendPasswordResetOtp, resetPasswordWithOtp, 
  resetPasswordWithCode, requestMagicLink, verifyMagicLink, verifySignupOtp 
} from '../api';
import { 
  AlertCircle, Loader2, User, Mail, 
  Lock, Ticket, ArrowRight, CheckCircle2, Wand2, KeyRound 
} from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const magicToken = searchParams.get('token');

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [mode, setMode] = useState('login'); // login | signup | signupVerify | forgot
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [forgotMethod, setForgotMethod] = useState('emailOtp');
  const [magicLinkMode, setMagicLinkMode] = useState(false);

  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';
  const isSignup = mode === 'signup';
  const isSignupVerify = mode === 'signupVerify';

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', collegeId: '',
    inviteCode: '', otp: '', resetCode: '', newPassword: ''
  });

  const getPasswordStrength = (pass) => {
    let score = 0;
    if (!pass) return score;
    if (pass.length > 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return Math.min(4, score);
  };
  const strength = getPasswordStrength(formData.password);

  useEffect(() => {
    if (location.pathname === '/auth/magic-link' && magicToken) {
      handleMagicLinkVerification(magicToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, magicToken]);

  const handleMagicLinkVerification = async (token) => {
    setVerifyingToken(true);
    setError('');
    try {
      const response = await verifyMagicLink({ token });
      localStorage.setItem('profile', JSON.stringify(response.data));
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || "Invalid or expired magic link.";
      setError(message);
      setVerifyingToken(false);
      setMode('login');
      navigate('/login');
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0; let height = 0;
    let frameId = null; let pointerX = 0; let pointerY = 0;

    const particleCount = 140;
    const particles = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 22,
      y: (Math.random() - 0.5) * 14,
      z: Math.random() * 22 - 11,
      speed: 0.02 + Math.random() * 0.035,
      size: 0.5 + Math.random() * 0.95,
      seed: Math.random() * Math.PI * 2,
    }));

    const project = (point) => {
      const depth = 22;
      const scale = depth / (depth + point.z + 12);
      return {
        x: point.x * scale * 44 + width / 2,
        y: point.y * scale * 44 + height / 2,
        scale,
      };
    };

    const drawParticles = (t) => {
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.z += p.speed;
        if (p.z > 11) {
          p.z = -11;
          p.x = (Math.random() - 0.5) * 22;
          p.y = (Math.random() - 0.5) * 14;
        }

        const depthFactor = 1 - (p.z + 11) / 22;
        const driftX = Math.sin(t * 0.4 + p.seed) * 0.22;
        const driftY = Math.cos(t * 0.32 + p.seed) * 0.2;
        const parallaxX = pointerX * (0.45 + depthFactor * 1.05);
        const parallaxY = pointerY * (0.4 + depthFactor * 0.9);
        const pt = project({ x: p.x + driftX + parallaxX, y: p.y + driftY + parallaxY, z: p.z });

        if (pt.x < -40 || pt.x > width + 40 || pt.y < -40 || pt.y > height + 40) continue;

        const alpha = Math.max(0.08, Math.min(0.85, 0.12 + pt.scale * 0.6));
        ctx.fillStyle = `rgba(148, 197, 253, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size * (0.55 + pt.scale * 1.6), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const draw = (timeMs) => {
      const t = timeMs * 0.001;
      ctx.clearRect(0, 0, width, height);
      drawParticles(t);
    };

    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const onPointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.9;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.75;
    };
    const onPointerLeave = () => { pointerX = 0; pointerY = 0; };
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);

    const animate = (timeMs) => {
      draw(timeMs);
      frameId = window.requestAnimationFrame(animate);
    };

    if (prefersReduced) draw(0);
    else frameId = window.requestAnimationFrame(animate);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      observer.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setNotice('');

    try {
      if (isForgot) {
        if (forgotMethod === 'emailOtp') {
          if (!otpSent) {
            await sendPasswordResetOtp({ email: formData.email, collegeId: formData.collegeId });
            setOtpSent(true);
            setNotice('OTP sent. Check your email.');
            setLoading(false);
            return;
          }
          await resetPasswordWithOtp({
            email: formData.email, collegeId: formData.collegeId,
            otp: formData.otp, newPassword: formData.newPassword,
          });
          setNotice('Password changed successfully. Please sign in.');
          setMode('login'); setOtpSent(false); setForgotMethod('emailOtp');
          setFormData({ ...formData, otp: '', resetCode: '', newPassword: '' });
        } else {
          await resetPasswordWithCode({
            collegeId: formData.collegeId,
            resetCode: formData.resetCode, newPassword: formData.newPassword,
          });
          setNotice('Password changed successfully. Please sign in.');
          setMode('login'); setOtpSent(false); setForgotMethod('emailOtp');
          setFormData({ ...formData, otp: '', resetCode: '', newPassword: '' });
        }
      } else if (isSignupVerify) {
        await verifySignupOtp({ email: formData.email, otp: formData.otp });
        setNotice('Email verified! Account pending admin approval.');
        setMode('login');
      } else if (isLogin) {
        if (magicLinkMode) {
          await requestMagicLink({ email: formData.email });
          setNotice('Magic link sent to your email. Check your inbox.');
        } else {
          const response = await login({ email: formData.email, password: formData.password });
          localStorage.setItem('profile', JSON.stringify(response.data));
          window.location.href = '/dashboard';
        }
      } else if (isSignup) {
        await register(formData);
        setNotice('OTP sent to your email. Please verify.');
        setMode('signupVerify');
      }
    } catch (err) {
      const fieldError = err.response?.data?.errors?.[0]?.message;
      const code = String(err.response?.data?.code || '').trim();
      const message = fieldError || err.response?.data?.message || "Connection failed. Please check your network.";
      if (isLogin && code === 'ACCOUNT_PENDING_APPROVAL') {
        setError('');
        setNotice('Account pending admin approval. Ask Admin/Head to approve your profile.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifyingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sans auth-bg">
         <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden font-sans auth-bg">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black/90 pointer-events-none" />

      <motion.div 
        layout
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative w-full max-w-[420px] z-10"
      >
        <div className="bg-white border border-slate-200 shadow-sm-strong rounded-3xl p-8 sm:p-10 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-1 gradient-blue-purple opacity-50" />
          
          <header className="text-center mb-8">
            <motion.div 
              layoutId="logo"
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-6 bg-white shadow-lg glow-blue p-1"
            >
              <img src="/cicr-logo.png" alt="CICR Logo" className="w-full h-full object-cover rounded-full" />
            </motion.div>
            <h2 className="text-3xl text-slate-900 font-bold tracking-tight">
              {isForgot ? (otpSent ? 'Set Password' : 'Reset Password') 
                : isSignupVerify ? 'Verify Email' 
                : (isLogin ? 'Welcome Back' : 'Create Account')}
            </h2>
            <p className="text-slate-600 mt-2 text-sm font-medium">
              {isForgot ? 'Securely recover your account'
                : isSignupVerify ? 'Enter the OTP sent to your email'
                : (isLogin ? 'Sign in to access your workspace' : 'Join the community')}
            </p>
          </header>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                key="error"
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                className="bg-rose-500/10 border border-red-200 text-red-600 p-4 rounded-xl mb-6 flex items-start gap-3 text-sm"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
            {!error && notice && (
              <motion.div
                key="notice"
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                className="bg-blue-500/10 border border-blue-300 text-blue-600 p-4 rounded-xl mb-6 flex items-start gap-3 text-sm"
              >
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <span>{notice}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              
              {/* === SIGNUP MODE === */}
              {isSignup && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <InputGroup icon={User} name="name" label="Full Name" placeholder="Full Name" value={formData.name} onChange={handleChange} />
                  <InputGroup icon={KeyRound} name="collegeId" label="College ID" placeholder="Enrollment No." value={formData.collegeId} onChange={handleChange} />
                  <InputGroup icon={Ticket} name="inviteCode" label="Access Code" placeholder="Invite Code" value={formData.inviteCode} onChange={handleChange} />
                  <InputGroup icon={Mail} name="email" label="Email Address" type="email" placeholder="Email Address" value={formData.email} onChange={handleChange} />
                  <InputGroup icon={Lock} name="password" label="Password" type="password" placeholder="Create Password" value={formData.password} onChange={handleChange} />
                  
                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="pt-1">
                      <div className="flex gap-1 h-1.5 w-full">
                        {[...Array(4)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`flex-1 rounded-full transition-colors duration-300 ${
                              i < strength 
                                ? ['bg-rose-500', 'bg-orange-500', 'bg-amber-400', 'bg-emerald-500'][strength-1] 
                                : 'bg-gray-700'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] mt-1.5 text-slate-600 font-medium uppercase tracking-wider text-right">
                        {['Weak', 'Fair', 'Good', 'Strong'][Math.max(0, strength - 1)] || 'Too Short'}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* === SIGNUP VERIFY MODE === */}
              {isSignupVerify && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <InputGroup icon={Ticket} name="otp" label="Verification OTP" placeholder="6-digit OTP" value={formData.otp} onChange={handleChange} maxLength={6} />
                </motion.div>
              )}

              {/* === LOGIN MODE === */}
              {isLogin && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Magic Link Toggle */}
                  <div className="flex bg-slate-100 p-1 rounded-xl mb-4 relative z-0 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setMagicLinkMode(false)}
                      className={`flex-1 text-xs font-semibold uppercase tracking-wider py-2 rounded-lg transition-all z-10 ${!magicLinkMode ? 'text-slate-900' : 'text-slate-600 hover:text-slate-700'}`}
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setMagicLinkMode(true)}
                      className={`flex-1 text-xs font-semibold uppercase tracking-wider py-2 rounded-lg transition-all z-10 flex items-center justify-center gap-1.5 ${magicLinkMode ? 'text-slate-900' : 'text-slate-600 hover:text-slate-700'}`}
                    >
                      <Wand2 size={12} />
                      Magic Link
                    </button>
                    <motion.div 
                      className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-blue-500/20 border border-blue-300 rounded-lg -z-10"
                      animate={{ left: magicLinkMode ? 'calc(50% + 2px)' : '4px' }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  </div>

                  <InputGroup icon={Mail} name="email" label={magicLinkMode ? "Email Address" : "Email or College ID"} placeholder={magicLinkMode ? "name@example.com" : "Email or Enrollment No."} value={formData.email} onChange={handleChange} />
                  
                  <AnimatePresence>
                    {!magicLinkMode && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <InputGroup icon={Lock} name="password" label="Password" type="password" placeholder="••••••••" value={formData.password} onChange={handleChange} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* === FORGOT PASSWORD MODE === */}
              {isForgot && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => { setForgotMethod('emailOtp'); setOtpSent(false); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                        forgotMethod === 'emailOtp'
                          ? 'bg-blue-500/20 text-blue-600 border border-blue-300'
                          : 'text-slate-600 hover:text-slate-700'
                      }`}
                    >
                      Email OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => { setForgotMethod('resetCode'); setOtpSent(false); }}
                      className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                        forgotMethod === 'resetCode'
                          ? 'bg-blue-500/20 text-blue-600 border border-blue-300'
                          : 'text-slate-600 hover:text-slate-700'
                      }`}
                    >
                      Reset Code
                    </button>
                  </div>
                  
                  {forgotMethod === 'emailOtp' && !otpSent && (
                    <InputGroup icon={Mail} name="email" label="Email Address" type="text" placeholder="Registered Email" value={formData.email} onChange={handleChange} />
                  )}

                  <InputGroup icon={KeyRound} name="collegeId" label="College ID" placeholder="Enrollment No." value={formData.collegeId} onChange={handleChange} />

                  {forgotMethod === 'emailOtp' && otpSent && (
                    <>
                      <InputGroup icon={Ticket} name="otp" label="OTP" placeholder="6-digit OTP" value={formData.otp} onChange={handleChange} />
                      <InputGroup icon={Lock} name="newPassword" label="New Password" type="password" placeholder="New Password" value={formData.newPassword} onChange={handleChange} />
                    </>
                  )}

                  {forgotMethod === 'resetCode' && (
                    <>
                      <InputGroup icon={Ticket} name="resetCode" label="Reset Code" placeholder="Admin Code" value={formData.resetCode} onChange={handleChange} />
                      <InputGroup icon={Lock} name="newPassword" label="New Password" type="password" placeholder="New Password" value={formData.newPassword} onChange={handleChange} />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading || (isSignup && strength < 2)} // Require at least fair password
              className="w-full text-slate-900 py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all flex justify-center items-center gap-2 mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                <>
                  {isForgot ? (forgotMethod === 'emailOtp' ? (otpSent ? 'Change Password' : 'Send OTP') : 'Reset Password')
                    : isSignupVerify ? 'Verify & Continue'
                    : isLogin ? (magicLinkMode ? 'Send Magic Link' : 'Sign In')
                    : 'Create Account'}
                  <ArrowRight size={16} />
                </>
              )}
            </motion.button>
          </form>

          <div className="text-center mt-8 flex flex-col items-center gap-3">
            {isLogin && !magicLinkMode && (
              <button
                onClick={() => { setMode('forgot'); setOtpSent(false); setError(''); setNotice(''); }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Forgot Password?
              </button>
            )}
            
            <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-700 to-transparent my-1" />

            <button
              onClick={() => {
                setMode(isForgot || isSignupVerify || isSignup ? 'login' : 'signup');
                setError(''); setNotice('');
              }}
              className="text-sm font-semibold text-blue-400 hover:text-blue-600 transition-colors"
            >
              {isForgot || isSignupVerify ? 'Back to Sign In' 
               : isLogin ? "Don't have an account? Sign Up" 
               : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function InputGroup({ icon: Icon, label, required = true, ...props }) {
  const fieldId = props.id || props.name;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600 ml-1">
          {label}
        </label>
      )}
      <div className="relative group">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors">
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <input
          required={required}
          id={fieldId}
          {...props}
          className="w-full bg-slate-50 border border-slate-300/50 p-3.5 pl-11 rounded-xl text-slate-900 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-gray-600"
        />
      </div>
    </div>
  );
}
