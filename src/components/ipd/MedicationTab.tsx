import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAdmission, useAddMedication, useRemoveMedication, Medication } from '@/hooks/useIpdApi';

export const MedicationTab = ({ admissionId }: { admissionId: string }) => {
  const { data: admission } = useAdmission(admissionId);
  const addMedication = useAddMedication();
  const removeMedicationMutation = useRemoveMedication();
  const { register, handleSubmit, reset } = useForm<Omit<Medication, '_id'>>();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const medications = admission?.medications || [];

  const onSubmit = (data: Omit<Medication, '_id'>) => {
    addMedication.mutate(
      { admissionId, medication: data },
      {
        onSuccess: () => {
          toast.success('Medication added successfully');
          reset();
          setIsDialogOpen(false);
        },
        onError: (error) => {
          toast.error(`Failed to add medication: ${error.message}`);
        },
      }
    );
  };

  const handleRemoveMedication = (medicationId: string) => {
    removeMedicationMutation.mutate(
      { admissionId, medicationId },
      {
        onSuccess: () => {
          toast.success('Medication removed');
        },
        onError: (error) => {
          toast.error(`Failed to remove medication: ${error.message}`);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Medication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {medications.length > 0 ? (
          <div className="space-y-4">
            {medications.map(med => (
              <div key={med._id} className="border-b pb-4 last:border-0">
                <div className="flex justify-between">
                  <h3 className="font-medium">{med.name}</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-red-600"
                    onClick={() => handleRemoveMedication(med._id)}
                    disabled={removeMedicationMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <p>Dosage: {med.dosage}</p>
                  <p>Frequency: {med.frequency}</p>
                  <p>Route: {med.route}</p>
                  <p>Period: {med.startDate} to {med.endDate || 'Ongoing'}</p>
                </div>
                {med.notes && <p className="mt-2 text-sm">Notes: {med.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No medications added.</p>
        )}
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add Medication</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Medication Name</Label>
                <Input {...register('name', { required: true })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dosage</Label>
                  <Input {...register('dosage', { required: true })} />
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Input {...register('frequency', { required: true })} />
                </div>
                <div>
                  <Label>Route</Label>
                  <Input {...register('route', { required: true })} />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" {...register('startDate', { required: true })} />
                </div>
                <div>
                  <Label>End Date (optional)</Label>
                  <Input type="date" {...register('endDate')} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input {...register('notes')} />
              </div>
              <Button type="submit" disabled={addMedication.isPending}>
                {addMedication.isPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default MedicationTab;
