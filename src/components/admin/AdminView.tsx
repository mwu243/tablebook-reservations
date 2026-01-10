import { ReservationsList } from './ReservationsList';
import { AvailabilityManager } from './AvailabilityManager';
import { LotteryManager } from './LotteryManager';
import { SlotsManager } from './SlotsManager';

export function AdminView() {
  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your restaurant's availability and view upcoming reservations
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-8">
            <SlotsManager />
            <ReservationsList />
            <LotteryManager />
          </div>
          <AvailabilityManager />
        </div>
      </div>
    </div>
  );
}
