import { useState } from 'react';
import { CalendarDays, User, Settings } from 'lucide-react';
import { MealTime, AvailabilitySlot } from '@/lib/types';
import { useAvailabilitySlots } from '@/hooks/useAvailabilitySlots';
import { HeroSection } from './HeroSection';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { SlotsPanel } from './SlotsPanel';
import { BookingModal } from './BookingModal';
import { MyReservations } from './MyReservations';
import { AvailabilityManager } from '@/components/admin/AvailabilityManager';
import { SlotsManager } from '@/components/admin/SlotsManager';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function CustomerView() {
  const { user, isAdmin } = useAuth();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [partySize, setPartySize] = useState(2);
  const [mealTime, setMealTime] = useState<MealTime>('all');
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [activeTab, setActiveTab] = useState('book');

  const { data: slots, isLoading } = useAvailabilitySlots(date, mealTime);

  const getTabGridCols = () => {
    if (user && isAdmin) return 'grid-cols-3';
    if (user) return 'grid-cols-2';
    return 'grid-cols-1';
  };

  return (
    <div className="min-h-screen pb-16">
      <HeroSection />
      
      <div className="container py-12">
        {user ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className={`grid w-full max-w-lg mx-auto ${getTabGridCols()}`}>
              <TabsTrigger value="book" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Book a Table
              </TabsTrigger>
              <TabsTrigger value="reservations" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                My Reservations
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="manage" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Manage Availability
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="book" className="mt-8">
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-semibold">Find Your Perfect Time</h2>
                <p className="mt-2 text-muted-foreground">
                  Select a date with availability to see open time slots
                </p>
              </div>

              <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
                <div>
                  <AvailabilityCalendar selected={date} onSelect={setDate} />
                </div>
                <div>
                  {date ? (
                    <SlotsPanel
                      date={date}
                      slots={slots}
                      isLoading={isLoading}
                      partySize={partySize}
                      onPartySizeChange={setPartySize}
                      mealTime={mealTime}
                      onMealTimeChange={setMealTime}
                      onSlotClick={setSelectedSlot}
                    />
                  ) : (
                    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border bg-card p-6 text-center shadow-sm">
                      <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
                      <h3 className="mt-4 text-lg font-medium">Select a Date</h3>
                      <p className="mt-2 text-muted-foreground">
                        Click on a date with a green dot to see available times
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="reservations" className="mt-8">
              <div className="mx-auto max-w-3xl">
                <MyReservations />
              </div>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="manage" className="mt-8">
                <div className="mx-auto max-w-4xl space-y-8">
                  <AvailabilityManager />
                  <SlotsManager />
                </div>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold">Find Your Perfect Time</h2>
              <p className="mt-2 text-muted-foreground">
                Select a date with availability to see open time slots
              </p>
            </div>

            <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
              <div>
                <AvailabilityCalendar selected={date} onSelect={setDate} />
              </div>
              <div>
                {date ? (
                  <SlotsPanel
                    date={date}
                    slots={slots}
                    isLoading={isLoading}
                    partySize={partySize}
                    onPartySizeChange={setPartySize}
                    mealTime={mealTime}
                    onMealTimeChange={setMealTime}
                    onSlotClick={setSelectedSlot}
                  />
                ) : (
                  <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border bg-card p-6 text-center shadow-sm">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-medium">Select a Date</h3>
                    <p className="mt-2 text-muted-foreground">
                      Click on a date with a green dot to see available times
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <BookingModal
        slot={selectedSlot}
        partySize={partySize}
        onClose={() => setSelectedSlot(null)}
      />
    </div>
  );
}
