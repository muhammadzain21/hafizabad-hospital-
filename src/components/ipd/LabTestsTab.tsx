import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useAdmission, useAddLabTest, useUpdateLabTest, LabTest } from '@/hooks/useIpdApi';

export const LabTestsTab = ({ admissionId }: { admissionId: string }) => {
  const { data: admission } = useAdmission(admissionId);
  const addLabTest = useAddLabTest();
  const updateLabTest = useUpdateLabTest();
  const { register, handleSubmit, reset, setValue } = useForm<Omit<LabTest, '_id' | 'status'>>();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const tests = admission?.labTests || [];

  const onSubmit = (data: Omit<LabTest, '_id' | 'status'>) => {
    addLabTest.mutate(
      { admissionId, labTest: { ...data, status: 'Ordered' } },
      {
        onSuccess: () => {
          toast.success('Lab test ordered successfully');
          reset();
          setIsDialogOpen(false);
        },
        onError: (error) => {
          toast.error(`Failed to order test: ${error.message}`);
        },
      }
    );
  };

  const handleUpdateStatus = (testId: string, status: LabTest['status'], result?: string) => {
    updateLabTest.mutate(
      { admissionId, testId, updates: { status, result } },
      {
        onSuccess: () => {
          toast.success(`Test marked as ${status}`);
        },
        onError: (error) => {
          toast.error(`Failed to update test: ${error.message}`);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lab Tests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tests.length > 0 ? (
          <div className="space-y-4">
            {tests.map(test => (
              <div key={test._id} className="border-b pb-4 last:border-0">
                <div className="flex justify-between">
                  <h3 className="font-medium">{test.testName}</h3>
                  <span className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                    {test.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <p>Type: {test.testType}</p>
                  <p>Ordered: {new Date(test.orderedDate).toLocaleDateString()}</p>
                  {test.result && <p>Result: {test.result}</p>}
                </div>
                {test.notes && <p className="mt-2 text-sm">Notes: {test.notes}</p>}
                
                {test.status === 'Ordered' && (
                  <div className="flex gap-2 mt-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleUpdateStatus(test._id, 'Completed', 'Normal')}
                      disabled={updateLabTest.isPending}
                    >
                      Mark Completed
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-600"
                      onClick={() => handleUpdateStatus(test._id, 'Cancelled')}
                      disabled={updateLabTest.isPending}
                    >
                      Cancel Test
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No lab tests ordered.</p>
        )}
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Order Lab Test</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Test Name</Label>
                <Input {...register('testName', { required: true })} />
              </div>
              <div>
                <Label>Test Type</Label>
                <Select onValueChange={val => setValue('testType', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select test type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blood">Blood Test</SelectItem>
                    <SelectItem value="Urine">Urine Test</SelectItem>
                    <SelectItem value="Imaging">Imaging</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Order Date</Label>
                <Input type="date" {...register('orderedDate', { required: true })} />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input {...register('notes')} />
              </div>
              <Button type="submit" disabled={addLabTest.isPending}>
                {addLabTest.isPending ? 'Ordering...' : 'Order Test'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default LabTestsTab;
