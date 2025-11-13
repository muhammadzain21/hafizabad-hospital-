import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFloors, useWards, useUpdateWard, useDeleteWard, Ward } from '@/hooks/useIpdApi';

const ManageWardsDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { data: floors = [] } = useFloors();
  const { data: wards = [] } = useWards();
  const updateWard = useUpdateWard();
  const deleteWard = useDeleteWard();

  const sortedFloors = useMemo(() => [...floors].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), [floors]);
  const floorName = (id?: string) => sortedFloors.find(f => f._id === id)?.name || id || 'None';

  const [editing, setEditing] = useState<Record<string, Partial<Ward>>>({});

  const startEdit = (ward: Ward) => {
    setEditing((prev) => ({
      ...prev,
      [ward._id]: { name: ward.name, floor: (ward as any).floor || '' },
    }));
  };

  const cancelEdit = (id: string) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveEdit = (id: string) => {
    const updates = editing[id];
    if (!updates || !updates.name || !(updates as any).floor) {
      alert('Please provide name and floor');
      return;
    }
    updateWard.mutate(
      { id, updates: { name: String(updates.name).trim(), floor: String((updates as any).floor) } },
      {
        onSuccess: () => cancelEdit(id),
        onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Failed to update ward'),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this ward? This is permanent.')) return;
    deleteWard.mutate(
      { id },
      { onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Failed to delete ward') }
    );
  };

  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>Manage Wards</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>Manage Wards</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-auto">
            {wards.length === 0 && (
              <div className="text-sm text-muted-foreground">No wards found.</div>
            )}
            {wards.map((w) => {
              const edit = editing[w._id];
              return (
                <div key={w._id} className="border rounded-md p-3 bg-white">
                  {!edit ? (
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                      <div>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-muted-foreground">Floor: {floorName((w as any).floor)}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(w)}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(w._id)} disabled={deleteWard.isPending}>Delete</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-3 gap-2 items-end">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={String(edit.name ?? '')}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [w._id]: { ...prev[w._id], name: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label>Floor</Label>
                        <select
                          className="w-full border p-2 rounded-md"
                          value={String((edit as any).floor ?? '')}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [w._id]: { ...prev[w._id], floor: e.target.value } }))}
                        >
                          <option value="" disabled>Select floor</option>
                          {sortedFloors.map((f) => (
                            <option key={f._id} value={f._id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(w._id)} disabled={updateWard.isPending}>{updateWard.isPending ? 'Saving…' : 'Save'}</Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit(w._id)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageWardsDialog;
