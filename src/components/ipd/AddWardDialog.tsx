import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateWard, useFloors } from '@/hooks/useIpdApi';

type AddWardDialogProps = {
  defaultFloorId?: string;
  triggerLabel?: string;
};

const AddWardDialog: React.FC<AddWardDialogProps> = ({ defaultFloorId, triggerLabel = 'Add Ward' }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [floorId, setFloorId] = useState('');
  const { data: floors = [] } = useFloors();
  const createWard = useCreateWard();

  const sortedFloors = useMemo(() => [...floors].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), [floors]);

  // Initialize selection whenever dialog opens
  useEffect(() => {
    if (open) {
      setFloorId(defaultFloorId || '');
    }
  }, [open, defaultFloorId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !floorId) return;
    createWard.mutate(
      { name: name.trim(), floor: floorId },
      { 
        onSuccess: () => { setOpen(false); setName(''); setFloorId(''); },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || err?.message || 'Failed to add ward';
          alert(msg);
        }
      }
    );
  };

  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>{triggerLabel}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader><DialogTitle>Add Ward</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Floor</Label>
              <select value={floorId} onChange={(e) => setFloorId(e.target.value)} className="w-full border p-2 rounded-md" required>
                <option value="" disabled>Select floor</option>
                {sortedFloors.map(f => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={createWard.isPending}>
              {createWard.isPending ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddWardDialog;
