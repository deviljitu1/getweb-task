import { useState, FormEvent } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';

const safeNext = (raw: string | null): string => {
  if (!raw) return '/';
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  } catch { /* ignore */ }
  return '/';
};
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import Seo from "@/components/Seo";
import { resolveLoginEmail } from '@/lib/login-id';

const Login = () => {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('saved_login_id') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextPath = safeNext(params.get('next'));


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to={nextPath} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginLoading(true);
    try {
      const trimmedId = email.trim();
      const loginEmail = resolveLoginEmail(trimmedId);
      const result = await login(loginEmail, password);
      if (result.error) {
        setError(result.error);
      } else {
        if (rememberMe) {
          try {
            localStorage.setItem('saved_login_id', trimmedId);
          } catch { /* ignore */ }
        } else {
          try {
            localStorage.removeItem('saved_login_id');
          } catch { /* ignore */ }
        }

        // Trigger native mobile/browser prompt to save credentials (Google Password Manager / Keychain)
        const PasswordCredentialClass = (window as Window & { PasswordCredential?: new (options: { id: string; password: string; name: string }) => Credential }).PasswordCredential;
        if (rememberMe && 'credentials' in navigator && PasswordCredentialClass) {
          try {
            const cred = new PasswordCredentialClass({
              id: trimmedId,
              password: password,
              name: trimmedId,
            });
            await navigator.credentials.store(cred);
          } catch {
            // Ignore if cancelled or unsupported in current environment
          }
        }

        navigate(nextPath);
      }
    } finally {
      setLoginLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex w-full">
      <Seo title="Sign in — GetWebApp" description="Sign in to GetWebApp to log daily tasks, run time timers, and review your team's work." path="/login" />
      {/* Left branding panel with animated gradient */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-primary/5">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/5 animate-gradient-xy" />

        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/30 rounded-full blur-[100px] opacity-70 animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] opacity-70 animate-pulse delay-700" />

        <div className="relative z-10 flex flex-col justify-center px-20 text-foreground h-full">
          <div className="mb-8 p-3 bg-white/10 w-fit rounded-2xl backdrop-blur-md border border-white/20 shadow-xl">
            <img src="/images/getweb-loader.gif" alt="GetWebApp" className="h-16 w-16 object-contain rounded-xl" />
          </div>
          <h1 className="text-6xl font-bold mb-6 tracking-tight leading-tight">
            Seamlessly <br />
            <span className="text-primary">Track Time.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
            Elevate your productivity with GetWebApp. Effortless time management for modern teams.
          </p>
        </div>

        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative">
        <div className="w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start mb-2">
              <div className="p-2 bg-primary/10 rounded-2xl border border-primary/20 shadow-sm">
                <img src="/images/getweb-loader.gif" alt="GetWebApp" className="h-14 w-14 object-contain rounded-xl" />
              </div>
            </div>
            <h2 className="whitespace-nowrap text-xl min-[360px]:text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
              Hey, welcome back.
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Let’s make today count.
            </p>
          </div>

          <form method="post" action="#" onSubmit={handleSubmit} autoComplete="on" className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 animate-in fade-in zoom-in-95">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">ID / Email</Label>
                <Input
                  id="email"
                  name="username"
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your ID or email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  className="h-12 bg-muted/30 border-input/60 focus:bg-background transition-all duration-300"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a href="#" className="text-sm font-medium text-primary hover:underline underline-offset-4">Forgot password?</a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-12 bg-muted/30 border-input/60 focus:bg-background transition-all duration-300 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(!!checked)}
                />
                <Label
                  htmlFor="rememberMe"
                  className="text-sm font-normal text-muted-foreground cursor-pointer select-none"
                >
                  Save password on this device
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium shadow-lg hover:shadow-primary/25 transition-all duration-300"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Sign in <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Need access? Contact your workspace administrator.
          </p>

        </div>
      </div>
    </div>
  );
};

export default Login;
