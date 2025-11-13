import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateRoom, useFloors } from '@/hooks/useIpdApi';

const AddRoomDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [floorId, setFloorId] = useState('');
  const { data: floors = [] } = useFloors();
  const createRoom = useCreateRoom();

  const sortedFloors = useMemo(() =>
    [...floors].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), [floors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !floorId) return;
    createRoom.mutate(
      { name: name.trim(), floorId },
      { 
        onSuccess: () => { setOpen(false); setName(''); setFloorId(''); },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || err?.message || 'Failed to add room';
          alert(msg);
        }
      }
    );
  };

  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Add Room</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader><DialogTitle>Add Room</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Floor</Label>
              <select value={floorId} onChange={(e) => setFloorId(e.target.value)} className="w-full border p-2 rounded-md" required>
                <option value="" disabled>Select floor</option>
                {sortedFloors.map(f => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={createRoom.isPending}>
              {createRoom.isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddRoomDialog;
