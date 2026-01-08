import { useState } from 'react';
import { ViewMode } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { CustomerView } from '@/components/customer/CustomerView';
import { AdminView } from '@/components/admin/AdminView';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('customer');

  return (
    <div className="min-h-screen bg-background">
      <Navbar viewMode={viewMode} onViewModeChange={setViewMode} />
      {viewMode === 'customer' ? <CustomerView /> : <AdminView />}
    </div>
  );
};

export default Index;
