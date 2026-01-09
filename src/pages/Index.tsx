import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ViewMode } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { CustomerView } from '@/components/customer/CustomerView';
import { AdminView } from '@/components/admin/AdminView';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('customer');
  const queryClient = useQueryClient();

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    // Invalidate all queries to ensure fresh data when switching views
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
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
