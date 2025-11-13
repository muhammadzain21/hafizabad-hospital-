import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '../ui/use-toast';
import { useFloors } from '@/hooks/useIpdApi';
import { useCreateFloor } from '@/hooks/useIpdApi';

const AddFloorDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { data: floors = [] } = useFloors();
  const [name, setName] = useState('');
  const [number, setNumber] = useState<string>('');
  const createFloor = useCreateFloor();
  const { toast } = useToast();

  const duplicate = useMemo(() => floors.some(f => f.name.trim().toLowerCase() === name.trim().toLowerCase() || (number && f.number === Number(number))), [floors, name, number]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (duplicate) {
      toast({ title: 'Duplicate floor', description: 'A floor with this name or number already exists.', variant: 'destructive' });
      return;
    }
    createFloor.mutate(
      { name: name.trim(), number: number ? Number(number) : undefined },
      { onSuccess: () => { setOpen(false); setName(''); setNumber(''); } }
    );
  };

  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>Add Floor</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader><DialogTitle>Add Floor</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Number (optional)</Label>
              <Input type="number" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={duplicate}>Save</Button>
            {duplicate && <p className="text-red-500 text-sm mt-1">Floor with this name or number already exists.</p>}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddFloorDialog;
