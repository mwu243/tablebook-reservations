import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UtensilsCrossed, Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  venmoUsername: z.string().optional(),
  zelleIdentifier: z.string().optional(),
}).refine((data) => data.venmoUsername || data.zelleIdentifier, {
  message: 'Please provide at least one payment method (Venmo or Zelle)',
  path: ['payment'],
});

// Venmo username validation: alphanumeric, underscores, hyphens, 5-30 chars
const venmoRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{4,29}$/;
// Zelle: email or phone
const zelleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const zellePhoneRegex = /^[+]?[(]?[0-9]{1,3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signIn, signUp } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [venmoUsername, setVenmoUsername] = useState('');
  const [zelleIdentifier, setZelleIdentifier] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ 
    fullName?: string;
    email?: string; 
    password?: string;
    venmoUsername?: string;
    zelleIdentifier?: string;
    payment?: string;
    consent?: string;
  }>({});

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const validateSignIn = () => {
    try {
      signInSchema.parse({ email, password });
      setValidationErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: typeof validationErrors = {};
        err.errors.forEach((e) => {
          if (e.path[0] === 'email') errors.email = e.message;
          if (e.path[0] === 'password') errors.password = e.message;
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const validateSignUp = () => {
    const errors: typeof validationErrors = {};
    
    // Basic validation
    try {
      signUpSchema.parse({ fullName, email, password, venmoUsername, zelleIdentifier });
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.errors.forEach((e) => {
          if (e.path[0] === 'fullName') errors.fullName = e.message;
          if (e.path[0] === 'email') errors.email = e.message;
          if (e.path[0] === 'password') errors.password = e.message;
          if (e.path[0] === 'payment') errors.payment = e.message;
        });
      }
    }
    
    // Venmo format validation
    if (venmoUsername && !venmoRegex.test(venmoUsername)) {
      errors.venmoUsername = 'Venmo username must be 5-30 characters (letters, numbers, underscores, hyphens)';
    }
    
    // Zelle format validation
    if (zelleIdentifier && !zelleEmailRegex.test(zelleIdentifier) && !zellePhoneRegex.test(zelleIdentifier)) {
      errors.zelleIdentifier = 'Please enter a valid email or phone number';
    }

    if (!consentChecked) {
      errors.consent = 'You must consent to data sharing to create an account';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!validateSignIn()) return;
    
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(error.message);
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!validateSignUp()) return;
    
    setIsLoading(true);
    const { error } = await signUp(email, password, {
      displayName: fullName.trim(),
      venmoUsername: venmoUsername || undefined,
      zelleIdentifier: zelleIdentifier || undefined,
      paymentSharingConsent: consentChecked,
    });
    setIsLoading(false);
    
    if (error) {
      if (error.message.includes('already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(error.message);
      }
    }
  };

  const clearFormErrors = () => {
    setError(null);
    setValidationErrors({});
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="flex items-center gap-2 mb-4">
        <UtensilsCrossed className="h-8 w-8 text-accent" />
        <span className="text-2xl font-semibold tracking-tight">Kellogg MMM SGD</span>
      </div>

      {/* Clear call-to-action message */}
      <div className="text-center mb-6 max-w-md">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Sign in to reserve your spot
        </h1>
        <p className="text-muted-foreground text-sm">
          You must sign in or create an account before booking a small group dinner. This helps us track attendance and manage payments.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <form onSubmit={handleSignIn}>
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Sign in to access your account and reservations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFormErrors();
                    }}
                    className={validationErrors.email ? 'border-destructive' : ''}
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-destructive">{validationErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFormErrors();
                    }}
                    className={validationErrors.password ? 'border-destructive' : ''}
                  />
                  {validationErrors.password && (
                    <p className="text-sm text-destructive">{validationErrors.password}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignUp}>
              <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>Sign up to get started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-fullname">Full Name</Label>
                  <Input
                    id="signup-fullname"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      clearFormErrors();
                    }}
                    className={validationErrors.fullName ? 'border-destructive' : ''}
                  />
                  {validationErrors.fullName && (
                    <p className="text-sm text-destructive">{validationErrors.fullName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearFormErrors();
                    }}
                    className={validationErrors.email ? 'border-destructive' : ''}
                  />
                  {validationErrors.email && (
                    <p className="text-sm text-destructive">{validationErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password (min 6 characters)"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFormErrors();
                    }}
                    className={validationErrors.password ? 'border-destructive' : ''}
                  />
                  {validationErrors.password && (
                    <p className="text-sm text-destructive">{validationErrors.password}</p>
                  )}
                </div>

                {/* Payment Info Section */}
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span>Payment Information</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Provide at least one payment method. This allows event hosts to request payment from participants.
                  </p>
                  
                  {validationErrors.payment && (
                    <p className="text-sm text-destructive">{validationErrors.payment}</p>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-venmo">Venmo Username</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                      <Input
                        id="signup-venmo"
                        type="text"
                        placeholder="username"
                        value={venmoUsername}
                        onChange={(e) => {
                          setVenmoUsername(e.target.value.replace('@', ''));
                          clearFormErrors();
                        }}
                        className={`pl-8 ${validationErrors.venmoUsername ? 'border-destructive' : ''}`}
                      />
                    </div>
                    {validationErrors.venmoUsername && (
                      <p className="text-sm text-destructive">{validationErrors.venmoUsername}</p>
                    )}
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">or</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-zelle">Zelle Email or Phone</Label>
                    <Input
                      id="signup-zelle"
                      type="text"
                      placeholder="email@example.com or (555) 123-4567"
                      value={zelleIdentifier}
                      onChange={(e) => {
                        setZelleIdentifier(e.target.value);
                        clearFormErrors();
                      }}
                      className={validationErrors.zelleIdentifier ? 'border-destructive' : ''}
                    />
                    {validationErrors.zelleIdentifier && (
                      <p className="text-sm text-destructive">{validationErrors.zelleIdentifier}</p>
                    )}
                  </div>
                </div>

                {/* Data Sharing Consent */}
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent-checkbox"
                      checked={consentChecked}
                      onCheckedChange={(checked) => {
                        setConsentChecked(checked === true);
                        clearFormErrors();
                      }}
                      className="mt-0.5"
                    />
                    <Label htmlFor="consent-checkbox" className="text-sm leading-relaxed cursor-pointer">
                      I consent to sharing my name, email, and payment information (Venmo/Zelle) with event hosts for bill-splitting purposes.
                    </Label>
                  </div>
                  {validationErrors.consent && (
                    <p className="text-sm text-destructive">{validationErrors.consent}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
      
      <p className="mt-4 text-sm text-muted-foreground">
        <a href="/" className="hover:text-accent underline">← Back to booking</a>
      </p>
    </div>
  );
}
