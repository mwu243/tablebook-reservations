import { ViewMode } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { UtensilsCrossed, Shield } from 'lucide-react';

interface NavbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function Navbar({ viewMode, onViewModeChange }: NavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6 text-accent" />
          <span className="text-xl font-semibold tracking-tight">TableBook</span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium transition-colors ${viewMode === 'customer' ? 'text-foreground' : 'text-muted-foreground'}`}>
            Customer
          </span>
          <Switch
            checked={viewMode === 'admin'}
            onCheckedChange={(checked) => onViewModeChange(checked ? 'admin' : 'customer')}
            className="data-[state=checked]:bg-accent"
          />
          <div className={`flex items-center gap-1.5 transition-colors ${viewMode === 'admin' ? 'text-foreground' : 'text-muted-foreground'}`}>
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
