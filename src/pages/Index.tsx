import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ViewMode } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { CustomerView } from '@/components/customer/CustomerView';
import { AdminView } from '@/components/admin/AdminView';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('customer');
  const queryClient = useQueryClient();
  const { user, isAdmin, isLoading } = useAuth();

  // Reset to customer view if user is no longer admin
  useEffect(() => {
    if (!isLoading && viewMode === 'admin' && (!user || !isAdmin)) {
      setViewMode('customer');
    }
  }, [user, isAdmin, isLoading, viewMode]);

  const handleViewModeChange = (mode: ViewMode) => {
    // Only allow admin view if user is authenticated and has admin role
    if (mode === 'admin' && (!user || !isAdmin)) {
      return;
    }
    
    setViewMode(mode);
    // Invalidate all queries to ensure fresh data when switching views
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
    queryClient.invalidateQueries({ queryKey: ['month-availability'] });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar viewMode={viewMode} onViewModeChange={handleViewModeChange} />
      {viewMode === 'customer' ? <CustomerView /> : <AdminView />}
    </div>
  );
};

export default Index;
