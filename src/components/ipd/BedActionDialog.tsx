import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bed } from '@/hooks/useIpdApi';

import { IpdAdmission } from '@/hooks/useIpdApi';
import { useNavigate } from 'react-router-dom';

interface BedActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bed: Bed | null;
  admission?: IpdAdmission | null;
  onEdit: (bed: Bed, updates: Partial<Bed>) => void;
  onDelete: (bed: Bed) => void;
}

export const BedActionDialog: React.FC<BedActionDialogProps> = ({ open, onOpenChange, bed, admission, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const [editMode, setEditMode] = React.useState(false);
  const [bedNumber, setBedNumber] = React.useState(bed?.bedNumber || '');
  const [category, setCategory] = React.useState((bed as any)?.category || 'General');
  const [rentAmount, setRentAmount] = React.useState<string>(
    (typeof (bed as any)?.rentAmount === 'number' ? String((bed as any).rentAmount) : '')
  );

  React.useEffect(() => {
    setBedNumber(bed?.bedNumber || '');
    setCategory((bed as any)?.category || 'General');
    setRentAmount(typeof (bed as any)?.rentAmount === 'number' ? String((bed as any).rentAmount) : '');
    setEditMode(false);
  }, [bed, open]);

  if (!bed) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bed Actions</DialogTitle>
        </DialogHeader>
        {!editMode ? (
          <>
            <div className="mb-4">
              <p>Bed <b>{bed.bedNumber}</b> ({bed.status})</p>
              <p className="text-sm text-muted-foreground">Choose an action below:</p>
            </div>
            <DialogFooter className="flex gap-2">
              {bed.status === 'Occupied' && admission && (
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  onClick={() => {
                    navigate(`/ipd/patient/${admission._id}`);
                    onOpenChange(false);
                  }}
                >
                  View Profile
                </Button>
              )}
              {/* Show Edit for both Available and Occupied */}
              <Button variant="secondary" onClick={() => setEditMode(true)}>Edit</Button>
              <Button variant="destructive" onClick={() => {
                if (window.confirm('Are you sure you want to delete this bed? This action cannot be undone.')) {
                  onDelete(bed);
                  onOpenChange(false);
                }
              }}>Delete</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={e => {
            e.preventDefault();
            const updates: Partial<Bed> = {
              bedNumber,
              // @ts-ignore - Bed type includes category and rentAmount in hook types
              category: category as any,
              // @ts-ignore
              rentAmount: Number(rentAmount || 0),
            };
            onEdit(bed, updates);
            setEditMode(false);
            onOpenChange(false);
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bed Number</label>
              <Input value={bedNumber} onChange={e => setBedNumber(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                className="w-full border p-2 rounded-md"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="General">General</option>
                <option value="Private">Private</option>
                <option value="Semi-Private">Semi-Private</option>
                <option value="ICU">ICU</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Charges (per day)</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 1500"
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BedActionDialog;
