import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SplitLayout } from '@/components/layout';
import { ModernCard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernInput } from '@/components/ui/ModernInput';
import { ModernBadge } from '@/components/ui/ModernBadge';
import { Brain, Mail, Lock, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';
import { useAuthStore } from '@/store';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: <Brain className="h-5 w-5" />,
    title: 'AI-Powered Analysis',
    description: 'Advanced market intelligence using GPT-4',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Secure & Private',
    description: 'Enterprise-grade security for your data',
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Real-time Insights',
    description: 'Live market updates and predictions',
  },
];

export const ModernLogin: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setFormData({
      email: 'admin@silverfin.com',
      password: 'password',
    });
  };

  return (
    <SplitLayout imageUrl="/auth-bg.jpg">
      <div className="w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl shadow-glow animate-float">
            <Brain className="h-8 w-8 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-display font-bold">
              Welcome to Silver Fin
            </h1>
            <p className="text-muted-foreground">
              AI-Powered Market Intelligence Platform
            </p>
          </div>
        </div>

        {/* Login Form */}
        <ModernCard variant="glass" className="animate-in slide-in-up duration-500">
          <CardHeader className="space-y-1 text-center">
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <ModernInput
                label="Email"
                type="email"
                placeholder="name@company.com"
                icon={<Mail className="h-4 w-4" />}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                error={error && 'Invalid credentials'}
              />
              
              <ModernInput
                label="Password"
                type="password"
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4" />}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
              
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-input" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              
              <ModernButton
                type="submit"
                variant="gradient"
                fullWidth
                loading={loading}
                icon={<ArrowRight className="h-4 w-4" />}
                iconPosition="right"
              >
                Sign In
              </ModernButton>
            </form>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            
            <ModernButton
              variant="outline"
              fullWidth
              onClick={handleDemoLogin}
              icon={<Sparkles className="h-4 w-4" />}
            >
              Use Demo Account
            </ModernButton>
            
            <p className="text-center text-xs text-muted-foreground mt-4">
              Demo credentials: admin@silverfin.com / password
            </p>
          </CardContent>
        </ModernCard>

        {/* Features */}
        <div className="grid grid-cols-1 gap-4">
          {features.map((feature, index) => (
            <div 
              key={index}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                'bg-muted/30 backdrop-blur-sm',
                'animate-in slide-in-left',
                `animation-delay-${(index + 1) * 100}`
              )}
            >
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                {feature.icon}
              </div>
              <div>
                <h3 className="text-sm font-medium">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>
            By signing in, you agree to our{' '}
            <a href="#" className="text-primary hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </SplitLayout>
  );
};