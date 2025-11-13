import React from 'react';
import { Button } from '@/components/ui/button';
import AddBedForm from './AddBedDialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const AddBedButtonWithForm: React.FC<{ onBedAdded?: () => void }> = ({ onBedAdded }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow">
        Add Bed
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-full">
          <DialogTitle className="sr-only">Add New Bed</DialogTitle>
          <AddBedForm onBedAdded={() => { setOpen(false); onBedAdded?.(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddBedButtonWithForm;
