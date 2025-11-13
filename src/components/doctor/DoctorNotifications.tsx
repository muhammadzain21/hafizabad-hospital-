import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { Input } from '@/components/ui/input';

interface IpdScheduleEvent {
  _id: string;
  dateTime: string;
  doctorId: string;
  doctorName: string;
  notes?: string;
  patientName: string;
  mrNumber: string;
  patientObjId: string;
  admissionId: string;
}

function formatDateISO(date: Date){
  // YYYY-MM-DD for server query
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

const DoctorNotifications: React.FC = () => {
  const { user } = useAuth();
  const doctorId = (user as any)?.doctorId || user?.id;
  const qc = useQueryClient();
  const todayStr = useMemo(() => formatDateISO(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const { data: allEvents = [], isFetching, refetch } = useQuery<IpdScheduleEvent[]>({
    queryKey: ['ipdSchedule', selectedDate, doctorId || 'all'],
    queryFn: async () => {
      const url = new URL('/api/ipd/schedule', window.location.origin);
      url.searchParams.set('date', selectedDate);
      if (doctorId) url.searchParams.set('doctorId', String(doctorId));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to load schedule');
      return res.json();
    },
    enabled: true,
    staleTime: 10_000,
  });

  const events = useMemo(() => {
    if (!doctorId) return allEvents || [];
    return (allEvents || []).filter(e => String((e as any).doctorId) === String(doctorId));
  }, [allEvents, doctorId]);

  // Real-time updates (create a lightweight socket connection scoped to this page)
  useEffect(() => {
    if (!doctorId) return; // Only join a room when we have a doctorId
    const base = API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const socket: Socket = io(base, { withCredentials: true, transports: ['websocket','polling'], path: '/socket.io' });
    socket.on('connect', () => socket.emit('doctor:register', doctorId));
    const invalidate = (payload?: any) => {
      console.debug('[socket] schedule event received', payload);
      qc.invalidateQueries({ queryKey: ['ipdSchedule', selectedDate, doctorId || 'all'] });
    };
    socket.on('ipd:visit-scheduled', invalidate);
    socket.on('ipd:visit-updated', invalidate);
    socket.on('ipd:visit-deleted', invalidate);
    return () => {
      socket.off('ipd:visit-scheduled', invalidate);
      socket.off('ipd:visit-updated', invalidate);
      socket.off('ipd:visit-deleted', invalidate);
      socket.disconnect();
    };
  }, [doctorId, qc, selectedDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-bold">Notifications</h2>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-[160px]"
          />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No notifications for today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Scheduled visits for you will appear here. Use the IPD “Schedule” dialog to add a visit for this doctor.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {events.map(ev => (
            <Card key={ev._id} className="hover:shadow-md transition">
              <CardHeader>
                <CardTitle className="text-base">{ev.patientName} <span className="text-xs text-muted-foreground">({ev.mrNumber || ev.patientObjId})</span></CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">When</span><span>{new Date(ev.dateTime).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Notes</span><span className="text-right whitespace-pre-wrap max-w-[260px]">{ev.notes || '—'}</span></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorNotifications;
