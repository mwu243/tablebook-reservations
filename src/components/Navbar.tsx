import { Link, useNavigate } from 'react-router-dom';
import { ViewMode } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { UtensilsCrossed, Shield, LogIn, LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function Navbar({ viewMode, onViewModeChange }: NavbarProps) {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    onViewModeChange('customer');
  };

  const handleAdminToggle = (checked: boolean) => {
    if (checked) {
      if (!user) {
        navigate('/auth');
        return;
      }
      if (!isAdmin) {
        // User is logged in but not an admin
        return;
      }
    }
    onViewModeChange(checked ? 'admin' : 'customer');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6 text-accent" />
          <span className="text-xl font-semibold tracking-tight">TableBook</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Admin toggle - only show if user is admin */}
          {user && isAdmin && (
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium transition-colors ${viewMode === 'customer' ? 'text-foreground' : 'text-muted-foreground'}`}>
                Customer
              </span>
              <Switch
                checked={viewMode === 'admin'}
                onCheckedChange={handleAdminToggle}
                className="data-[state=checked]:bg-accent"
              />
              <div className={`flex items-center gap-1.5 transition-colors ${viewMode === 'admin' ? 'text-foreground' : 'text-muted-foreground'}`}>
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Admin</span>
              </div>
            </div>
          )}

          {/* User menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Account</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    {isAdmin && (
                      <p className="text-xs leading-none text-accent font-medium mt-1">
                        Admin
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/master-admin')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Master Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
              <LogIn className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
