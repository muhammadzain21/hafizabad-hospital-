import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAddVitals, useAdmission, Vitals } from '@/hooks/useIpdApi';

type VitalsFormData = Omit<Vitals, '_id'>;

export const VitalsTab = ({ admissionId }: { admissionId: string }) => {
  const { data: admission } = useAdmission(admissionId);
  const addVitals = useAddVitals();
  const { register, handleSubmit, reset } = useForm<VitalsFormData>();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const vitals = admission?.vitals || [];

  const onSubmit = (data: VitalsFormData) => {
    addVitals.mutate(
      { admissionId, vitals: data },
      {
        onSuccess: () => {
          toast.success('Vitals recorded successfully');
          reset();
          setIsDialogOpen(false);
        },
        onError: (error) => {
          toast.error(`Failed to save vitals: ${error.message}`);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vitals & Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {vitals.length > 0 ? (
          <div className="space-y-4">
            {vitals.map((vital, index) => (
              <div key={index} className="border-b pb-4 last:border-0">
                <p className="text-sm text-muted-foreground">
                  {new Date(vital.dateTime).toLocaleString()}
                </p>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <p>BP: {vital.bp}</p>
                  <p>Heart Rate: {vital.heartRate}</p>
                  <p>Temperature: {vital.temperature}°C</p>
                  <p>Resp Rate: {vital.respRate}</p>
                </div>
                {vital.notes && <p className="mt-2">Notes: {vital.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No vitals recorded yet.</p>
        )}
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add Vitals / Note</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Blood Pressure</Label>
                  <Input {...register('bp', { required: true })} placeholder="120/80" />
                </div>
                <div>
                  <Label>Heart Rate</Label>
                  <Input {...register('heartRate', { required: true })} placeholder="72" />
                </div>
                <div>
                  <Label>Temperature (°C)</Label>
                  <Input {...register('temperature', { required: true })} placeholder="37" />
                </div>
                <div>
                  <Label>Respiratory Rate</Label>
                  <Input {...register('respRate', { required: true })} placeholder="18" />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input {...register('notes')} placeholder="Additional notes" />
              </div>
              <Button type="submit" disabled={addVitals.isPending}>
                {addVitals.isPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default VitalsTab;
