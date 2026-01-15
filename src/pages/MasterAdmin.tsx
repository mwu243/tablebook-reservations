import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Calendar, Ticket, Settings, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: string;
}

export default function MasterAdmin() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Fetch all users with their roles (using RPC or direct query)
  const { data: usersWithRoles, isLoading: usersLoading } = useQuery({
    queryKey: ['master-admin-users'],
    queryFn: async () => {
      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at');

      if (rolesError) throw rolesError;

      return roles?.map((r) => ({
        id: r.user_id,
        role: r.role,
        created_at: r.created_at,
      })) || [];
    },
    enabled: !!user && isAdmin,
    refetchInterval: 10000,
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['master-admin-stats'],
    queryFn: async () => {
      const [slotsResult, bookingsResult] = await Promise.all([
        supabase.from('availability_slots').select('id', { count: 'exact' }),
        supabase.rpc('get_admin_bookings'),
      ]);

      const totalSlots = slotsResult.count || 0;
      const bookings = bookingsResult.data || [];
      const totalBookings = bookings.length;
      const confirmedBookings = bookings.filter((b: any) => b.status === 'confirmed').length;
      const pendingLottery = bookings.filter((b: any) => b.status === 'pending_lottery').length;

      return {
        totalSlots,
        totalBookings,
        confirmedBookings,
        pendingLottery,
        totalUsers: usersWithRoles?.length || 0,
      };
    },
    enabled: !!user && isAdmin && !!usersWithRoles,
    refetchInterval: 10000,
  });

  if (authLoading || (!user || !isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar viewMode="admin" onViewModeChange={() => navigate('/')} />
      
      <main className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-accent" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Master Admin</h1>
              <p className="mt-1 text-muted-foreground">
                System maintenance and user management
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{usersWithRoles?.length || 0}</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Availability Slots</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalSlots || 0}</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalBookings || 0}</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Lottery</CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{stats?.pendingLottery || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Users</CardTitle>
            <CardDescription>
              All users are automatically granted admin privileges on signup
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : usersWithRoles && usersWithRoles.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithRoles.map((userRole) => (
                    <TableRow key={userRole.id}>
                      <TableCell className="font-mono text-xs">
                        {userRole.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant={userRole.role === 'admin' ? 'default' : 'secondary'}>
                          {userRole.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(userRole.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No users registered yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-8 border-accent/50 bg-accent/5">
          <CardHeader>
            <CardTitle className="text-lg">Automatic Admin Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              All new users are automatically assigned the <Badge variant="default" className="mx-1">admin</Badge> role upon signup. 
              This grants them access to both customer booking features and restaurant availability management.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
