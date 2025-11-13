import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFloors, useRooms, useUpdateRoom, useDeleteRoom, Room } from '@/hooks/useIpdApi';

const ManageRoomsDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { data: floors = [] } = useFloors();
  const { data: rooms = [] } = useRooms();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const sortedFloors = useMemo(() => [...floors].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)), [floors]);

  const [editing, setEditing] = useState<Record<string, Partial<Room>>>({});

  const startEdit = (room: Room) => {
    setEditing((prev) => ({
      ...prev,
      [room._id]: { name: room.name, floorId: (room as any).floorId },
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
    if (!updates || !updates.name || !(updates as any).floorId) {
      alert('Please provide name and floor');
      return;
    }
    updateRoom.mutate(
      { id, updates: { name: String(updates.name).trim(), floorId: String((updates as any).floorId) } },
      {
        onSuccess: () => cancelEdit(id),
        onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Failed to update room'),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this room? This is permanent.')) return;
    deleteRoom.mutate(
      { id },
      { onError: (err: any) => alert(err?.response?.data?.error || err?.message || 'Failed to delete room') }
    );
  };

  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>Manage Rooms</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>Manage Rooms</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-auto">
            {rooms.length === 0 && (
              <div className="text-sm text-muted-foreground">No rooms found.</div>
            )}
            {rooms.map((r) => {
              const edit = editing[r._id];
              return (
                <div key={r._id} className="border rounded-md p-3 bg-white">
                  {!edit ? (
                    <div className="flex flex-wrap items-center gap-3 justify-between">
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">Floor: {(r as any).floorId}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(r._id)} disabled={deleteRoom.isPending}>Delete</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-3 gap-2 items-end">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={String(edit.name ?? '')}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [r._id]: { ...prev[r._id], name: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label>Floor</Label>
                        <select
                          className="w-full border p-2 rounded-md"
                          value={String((edit as any).floorId ?? '')}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [r._id]: { ...prev[r._id], floorId: e.target.value } }))}
                        >
                          <option value="" disabled>Select floor</option>
                          {sortedFloors.map((f) => (
                            <option key={f._id} value={f._id}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(r._id)} disabled={updateRoom.isPending}>{updateRoom.isPending ? 'Saving…' : 'Save'}</Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit(r._id)}>Cancel</Button>
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

export default ManageRoomsDialog;
