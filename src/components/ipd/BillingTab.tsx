import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCurrencyPKR } from '@/utils/formatCurrencyPKR';
import { useAdmission, useAddBillingItem, useUpdateBillingItem, BillingItem } from '@/hooks/useIpdApi';
import { useCreateIpdFinanceRecord } from '@/hooks/useIpdFinanceApi';
import { ReceiptText, PlusCircle } from 'lucide-react';

export const BillingTab = ({ admissionId }: { admissionId: string }) => {
  const { data: admission } = useAdmission(admissionId);
  const addBillingItem = useAddBillingItem();
  const updateBillingItem = useUpdateBillingItem();
  const createFinanceRecord = useCreateIpdFinanceRecord();
  const { register, handleSubmit, reset, setValue } = useForm<Omit<BillingItem, '_id' | 'status'>>();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const billingItems = admission?.billing || [];

  const onSubmit = (data: Omit<BillingItem, '_id' | 'status'>) => {
    addBillingItem.mutate(
      { admissionId, item: { ...data, status: 'Pending' } },
      {
        onSuccess: () => {
          toast.success('Billing item added successfully');
          reset();
          setIsDialogOpen(false);
        },
        onError: (error) => {
          toast.error(`Failed to add item: ${error.message}`);
        },
      }
    );
  };

  const handleUpdateStatus = (itemId: string, status: 'Paid' | 'Cancelled') => {
    const item = billingItems.find(i => i._id === itemId);
    updateBillingItem.mutate(
      { admissionId, itemId, updates: { status } },
      {
        onSuccess: () => {
          toast.success(`Billing item marked as ${status}`);
          if (status === 'Paid' && item) {
            const pid = typeof admission?.patientId === 'string' ? admission?.patientId : (admission?.patientId as any)?._id;
            // Record as IPD Income on the Finance page
            createFinanceRecord.mutate({
              date: new Date(item.date || Date.now()).toISOString(),
              amount: Number(item.amount || 0),
              category: String(item.category || 'IPD Billing'),
              description: String(item.description || `Billing item on ${new Date(item.date).toLocaleDateString()}`),
              type: 'Income',
              department: 'IPD',
              patientId: pid,
              admissionId,
            }, {
              onSuccess: () => toast.success('Recorded in Finance as Income'),
              onError: (err: any)=> toast.error(`Finance record failed: ${err?.message||'Unknown error'}`)
            });
          }
        },
        onError: (error) => {
          toast.error(`Failed to update item: ${error.message}`);
        },
      }
    );
  };

  const totalPending = billingItems
    .filter(item => item.status === 'Pending')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalPaid = billingItems
    .filter(item => item.status === 'Paid')
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card>
      <CardHeader className="flex items-center gap-3">
        <span className="text-3xl">₨</span>
        <CardTitle className="text-2xl font-bold tracking-tight">Patient Billing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="border rounded-lg p-4 bg-red-50">
            <h3 className="font-medium flex items-center gap-1 text-red-700">
              <ReceiptText className="w-4 h-4" /> Pending
            </h3>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrencyPKR(totalPending)}
            </p>
          </div>
          <div className="border rounded-lg p-4 bg-green-50">
            <h3 className="font-medium flex items-center gap-1 text-green-700">
              <ReceiptText className="w-4 h-4" /> Paid
            </h3>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrencyPKR(totalPaid)}
            </p>
          </div>
        </div>

        {billingItems.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Amount (PKR)</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {billingItems.map(item => (
                  <tr key={item._id}>
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{item.description}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{item.category}</td>
                    <td className="px-4 py-2 text-right font-semibold text-indigo-700 whitespace-nowrap">{formatCurrencyPKR(item.amount)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${item.status === 'Paid' ? 'bg-green-100 text-green-800' : item.status === 'Cancelled' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {item.status === 'Pending' && (
                        <div className="flex gap-2 justify-center">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleUpdateStatus(item._id, 'Paid')}
                            disabled={updateBillingItem.isPending}
                          >
                            Mark Paid
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-600"
                            onClick={() => handleUpdateStatus(item._id, 'Cancelled')}
                            disabled={updateBillingItem.isPending}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end bg-indigo-50 px-6 py-4 rounded-b-lg border-t">
              <span className="font-semibold text-indigo-900 text-lg">Total: {formatCurrencyPKR(billingItems.reduce((sum, item) => sum + item.amount, 0))}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No billing entries yet.</p>
        )}
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <PlusCircle className="w-4 h-4" /> Add Charge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="sr-only">New Billing Charge</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input type="date" {...register('date', { required: true })} />
              </div>
              <div>
                <Label>Description</Label>
                <Input {...register('description', { required: true })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select onValueChange={val => setValue('category', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Room Charges">Room Charges</SelectItem>
                    <SelectItem value="Medication">Medication</SelectItem>
                    <SelectItem value="Lab Tests">Lab Tests</SelectItem>
                    <SelectItem value="Doctor Fees">Doctor Fees</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" {...register('amount', { required: true, valueAsNumber: true })} />
              </div>
              <Button type="submit" disabled={addBillingItem.isPending}>
                {addBillingItem.isPending ? 'Adding...' : 'Add Charge'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default BillingTab;
