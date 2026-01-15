import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ViewMode } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { CustomerView } from '@/components/customer/CustomerView';
import { AdminView } from '@/components/admin/AdminView';
import { AdminPinModal } from '@/components/admin/AdminPinModal';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('customer');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const queryClient = useQueryClient();

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === 'admin' && !isAdminAuthenticated) {
      setShowPinModal(true);
      return;
    }
    
    setViewMode(mode);
    // Invalidate all queries to ensure fresh data when switching views
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
    queryClient.invalidateQueries({ queryKey: ['month-availability'] });
  };

  const handlePinSuccess = () => {
    setIsAdminAuthenticated(true);
    setShowPinModal(false);
    setViewMode('admin');
    // Invalidate all queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
    queryClient.invalidateQueries({ queryKey: ['month-availability'] });
  };

  const handlePinCancel = () => {
    setShowPinModal(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar viewMode={viewMode} onViewModeChange={handleViewModeChange} />
      {viewMode === 'customer' ? <CustomerView /> : <AdminView />}
      
      <AdminPinModal
        open={showPinModal}
        onSuccess={handlePinSuccess}
        onCancel={handlePinCancel}
      />
    </div>
  );
};

export default Index;
