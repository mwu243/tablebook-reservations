import { useState, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

const SITE_PASSWORD = "MMMSGD2027";
const SESSION_KEY = "site_access_granted";

interface SitePasswordGateProps {
  children: ReactNode;
}

const SitePasswordGate = ({ children }: SitePasswordGateProps) => {
  const [granted, setGranted] = useState(() => sessionStorage.getItem(SESSION_KEY) === "true");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  if (granted) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SITE_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setGranted(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <CardTitle className="text-xl">Enter Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">Incorrect password</p>}
            <Button type="submit" className="w-full">Enter</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SitePasswordGate;
