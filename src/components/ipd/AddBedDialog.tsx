import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useFloors, useRooms, useWards } from '@/hooks/useIpdApi';

interface AddBedFormProps {
  onBedAdded?: () => void;
}

export const AddBedForm: React.FC<AddBedFormProps> = ({ onBedAdded }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    floorId: '',
    roomId: '',
    wardId: '',
    bedNumbers: '',
    category: 'General' as 'General' | 'Private' | 'ICU' | 'Semi-Private',
    rentAmount: '' as string, // charges per day
  });

  const { toast } = useToast();
  const { data: floors = [] } = useFloors();
  const { data: rooms = [] } = useRooms(form.floorId || undefined);
  const { data: wards = [] } = useWards();
  const filteredWards = wards.filter(w => {
    const matchFloor = !form.floorId || w.floor === form.floorId;
    const matchRoom = !form.roomId || (typeof (w as any).roomId === 'string' ? (w as any).roomId === form.roomId : (w as any).roomId?._id === form.roomId);
    return matchFloor && matchRoom;
  });
  const createBeds = useMutation({
    mutationFn: async () => {
      // Split, trim, dedupe
      const numbers = Array.from(new Set(
        form.bedNumbers
          .split(/[\,\n]+/)
          .map(s => s.trim())
          .filter(Boolean)
      ));
      const payloads = numbers.map(num => {
        const payload: any = {
          bedNumber: num,
          category: form.category,
          status: 'Available',
          rentType: 'daily',
          rentAmount: Number(form.rentAmount || 0),
        };
        
        // Only include wardId OR roomId, not both
        if (form.wardId) {
          payload.wardId = form.wardId;
        } else if (form.roomId) {
          payload.roomId = form.roomId;
        }
        
        return payload;
      });
      const results = await Promise.allSettled(payloads.map(p => api.post('/ipd/beds', p)));
      const okCount = results.filter(r => r.status === 'fulfilled').length;
      const fails = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map(r => r.reason?.response?.data?.error || r.reason?.message || 'Unknown error');
      return { okCount, failCount: fails.length, fails };
    },
    onSuccess: ({ okCount, failCount, fails }) => {
      qc.invalidateQueries({ queryKey: ['beds'] });
      if (okCount > 0) {
        toast({ title: 'Beds added', description: `${okCount} bed(s) created successfully.` });
        onBedAdded?.();
      }
      if (failCount > 0) {
        toast({ title: 'Some beds failed', description: `${failCount} bed(s) failed to add. Check console for details.`, variant: 'destructive' });
        console.warn('Bed creation failures:', fails);
      }
    },
    onError: (error: any) => {
      // Unexpected failure before per-item handling
      const msg = error?.response?.data?.error || error?.message || 'Failed to add bed(s)';
      console.error('Bed creation failed (mutation):', error?.response?.data || error);
      toast({ title: 'Error adding bed(s)', description: String(msg), variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bedNumbers.trim()) return;
    if (!form.wardId && !form.roomId) {
      toast({ title: 'Select ward or room', description: 'Please select either a ward or ensure a room is selected.' });
      return;
    }
    createBeds.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-white border rounded-lg p-4 shadow max-w-md">
      <h3 className="text-lg font-bold mb-2">Add New Bed</h3>
      {form.roomId && (
        <p className="text-sm text-green-600">Adding beds directly to the selected room.</p>
      )}
      {form.wardId && (
        <p className="text-sm text-blue-600">Adding beds to the selected ward.</p>
      )}
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <Label>Floor</Label>
          <select
            className="w-full border p-2 rounded-md bg-white"
            value={form.floorId}
            onChange={(e) => setForm({ ...form, floorId: e.target.value, roomId: '', wardId: '' })}
          >
            <option value="">All</option>
            {floors.map(f => (<option key={f._id} value={f._id}>{f.name}</option>))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Add beds to:</Label>
          <select
            className="w-full border p-2 rounded-md bg-white"
            value={form.roomId ? `room-${form.roomId}` : form.wardId ? `ward-${form.wardId}` : ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value.startsWith('room-')) {
                setForm({ ...form, roomId: value.replace('room-', ''), wardId: '' });
              } else if (value.startsWith('ward-')) {
                setForm({ ...form, wardId: value.replace('ward-', ''), roomId: '' });
              } else {
                setForm({ ...form, roomId: '', wardId: '' });
              }
            }}
          >
            <option value="">Select location</option>
            <optgroup label="Rooms">
              {rooms.map(r => (
                <option key={`room-${r._id}`} value={`room-${r._id}`}>{r.name} (Room)</option>
              ))}
            </optgroup>
            {filteredWards.length > 0 && (
              <optgroup label="Wards">
                {filteredWards.map(w => (
                  <option key={`ward-${w._id}`} value={`ward-${w._id}`}>{w.name} (Ward)</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Bed Numbers (comma or newline separated)</Label>
        <textarea
          className="w-full border p-2 rounded-md h-24"
          value={form.bedNumbers}
          onChange={(e) => setForm({ ...form, bedNumbers: e.target.value })}
          placeholder="1,2,3 or one per line"
          required
        />
      </div>
      <div className="space-y-1">
        <Label>Charges (per day)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          placeholder="e.g. 1500"
          value={form.rentAmount}
          onChange={(e) => setForm({ ...form, rentAmount: e.target.value })}
          required
        />
      </div>
      <div className="space-y-1">
        <Label>Category</Label>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as any })} className="w-full border p-2 rounded-md">
          <option value="General">General</option>
          <option value="Private">Private</option>
          <option value="Semi-Private">Semi-Private</option>
          <option value="ICU">ICU</option>
        </select>
      </div>
      <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">Add Bed</Button>
    </form>
  );
};

export default AddBedForm;
