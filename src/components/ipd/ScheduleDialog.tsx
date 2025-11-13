import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdmissions, useDoctors, useCreateScheduleEvent, useUpdateScheduleEvent, IpdScheduleEvent, IpdScheduleEventCreatePayload } from '@/hooks/useIpdApi';
import { toast } from '@/components/ui/use-toast';
import { Patient } from '@/hooks/usePatientApi';

const scheduleSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  dateTime: z.string().min(1, 'Date and time are required'),
  notes: z.string().optional(),
});

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: IpdScheduleEvent | null;
}

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ open, onOpenChange, event }) => {
  const { data: admissions = [] } = useAdmissions();
  const { data: doctors = [] } = useDoctors();
  const createEventMutation = useCreateScheduleEvent();
  const updateEventMutation = useUpdateScheduleEvent();

  const form = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      dateTime: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (event) {
      form.reset({
        patientId: event.patientObjId,
        doctorId: event.doctorId,
        dateTime: new Date(event.dateTime).toISOString().slice(0, 16),
        notes: event.notes || '',
      });
    } else {
      form.reset({
        patientId: '',
        doctorId: '',
        dateTime: '',
        notes: '',
      });
    }
  }, [event, form]);

  const handleSubmit = async (values: z.infer<typeof scheduleSchema>) => {
    // Explicitly cast to ensure type correctness
    const validatedValues = values as IpdScheduleEventCreatePayload;
    const payload: IpdScheduleEventCreatePayload = {
      ...validatedValues,
      dateTime: new Date(validatedValues.dateTime).toISOString(),
    };

    try {
      if (event) {
        await updateEventMutation.mutateAsync({ eventId: event._id, updates: payload });
        toast({ title: 'Schedule updated' });
      } else {
        await createEventMutation.mutateAsync(payload);
        toast({ title: 'Visit scheduled' });
      }
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save schedule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Schedule' : 'Schedule New Visit'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a patient" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {admissions
                        .filter(a => a.status === 'Admitted' && typeof a.patientId === 'object' && a.patientId !== null)
                        .map(admission => (
                          <SelectItem key={admission.patientId._id} value={admission.patientId._id}>
                            {admission.patientId.name} (MR: {admission.patientId.mrNumber})
                          </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="doctorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doctor</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a doctor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {doctors.map(doctor => (
                        <SelectItem key={doctor._id} value={doctor._id}>
                          {doctor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add any relevant notes for the visit" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createEventMutation.isPending || updateEventMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={createEventMutation.isPending || updateEventMutation.isPending}>
                {event ? (updateEventMutation.isPending ? 'Saving...' : 'Save Changes') : (createEventMutation.isPending ? 'Scheduling...' : 'Schedule Visit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleDialog;
