import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useDoctors, useAdmission, useAddDoctorVisit, DoctorVisit } from '@/hooks/useIpdApi';

export const DoctorVisitsTab = ({ admissionId }: { admissionId: string }) => {
  const { data: admission } = useAdmission(admissionId);
  const { data: doctors = [] } = useDoctors();
  const addDoctorVisit = useAddDoctorVisit();
  const { register, handleSubmit, reset } = useForm<Omit<DoctorVisit, '_id' | 'doctorName'>>();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const visits = admission?.doctorVisits || [];

  const onSubmit = (data: Omit<DoctorVisit, '_id' | 'doctorName'>) => {
    const doctor = doctors.find(d => d._id === data.doctorId);
    if (!doctor) {
      toast.error('Selected doctor not found.');
      return;
    }

    addDoctorVisit.mutate(
      { admissionId, visit: { ...data, doctorName: doctor.name } },
      {
        onSuccess: () => {
          toast.success('Doctor visit recorded successfully');
          reset();
          setIsDialogOpen(false);
        },
        onError: (error) => {
          toast.error(`Failed to record visit: ${error.message}`);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Doctor Visits</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {visits.length > 0 ? (
          <div className="space-y-4">
            {visits.map(visit => (
              <div key={visit._id} className="border-b pb-4 last:border-0">
                <div className="flex justify-between">
                  <h3 className="font-medium">Dr. {visit.doctorName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(visit.dateTime).toLocaleString()}
                  </p>
                </div>
                <div className="mt-2 space-y-2 text-sm">
                  {visit.diagnosis && <p><span className="font-medium">Diagnosis:</span> {visit.diagnosis}</p>}
                  {visit.treatment && <p><span className="font-medium">Treatment:</span> {visit.treatment}</p>}
                  {visit.notes && <p><span className="font-medium">Notes:</span> {visit.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No visits logged.</p>
        )}
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add Doctor Visit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="sr-only">Add Doctor Visit</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Date & Time</Label>
                <Input type="datetime-local" {...register('dateTime', { required: true })} />
              </div>
              <div>
                <Label>Doctor</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('doctorId', { required: true })}
                  
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(doctor => (
                    <option key={doctor._id} value={doctor._id}>
                      Dr. {doctor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Diagnosis</Label>
                <Textarea {...register('diagnosis')} />
              </div>
              <div>
                <Label>Treatment</Label>
                <Textarea {...register('treatment')} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea {...register('notes')} />
              </div>
              <Button type="submit" disabled={addDoctorVisit.isPending}>
                {addDoctorVisit.isPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default DoctorVisitsTab;
