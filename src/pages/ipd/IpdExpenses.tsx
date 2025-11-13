import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { formatCurrency } from '@/lib/utils';
import {
  useIpdFinanceRecords,
  useCreateIpdFinanceRecord,
  useDeleteIpdFinanceRecord,
  type FinanceRecord,
} from '@/hooks/useIpdFinanceApi';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Trash2, PlusIcon } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#A78BFA', '#34D399'];

type ExpenseForm = {
  amount: number;
  category: string;
  description?: string;
  date: string; // ISO string or yyyy-mm-dd
};

const IpdExpenses: React.FC = () => {
  const { data: allExpenses = [], refetch, isLoading } = useIpdFinanceRecords('Expense');
  const { mutate: createRecord, isPending: isCreating } = useCreateIpdFinanceRecord();
  const { mutate: deleteRecord, isPending: isDeleting } = useDeleteIpdFinanceRecord();

  // Date range filter state
  const [from, setFrom] = React.useState<string>('');
  const [to, setTo] = React.useState<string>('');

  const { register, handleSubmit, reset } = useForm<ExpenseForm>({
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = (data: ExpenseForm) => {
    const isoDate = data.date.length <= 10 ? new Date(data.date + 'T00:00:00').toISOString() : data.date;
    createRecord(
      {
        amount: Number(data.amount),
        category: data.category,
        description: data.description || '',
        type: 'Expense',
        department: 'IPD',
        date: isoDate,
      } as any,
      {
        onSuccess: () => {
          refetch();
          reset({ amount: undefined as any, category: '', description: '', date: new Date().toISOString().slice(0, 10) });
        },
      }
    );
  };

  // Apply date filtering client-side
  const filteredExpenses = React.useMemo(() => {
    const fromTime = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const toTime = to ? new Date(to + 'T23:59:59').getTime() : Infinity;
    return allExpenses.filter((e) => {
      const t = new Date(e.date).getTime();
      return t >= fromTime && t <= toTime && e.department === 'IPD' && e.type === 'Expense';
    });
  }, [allExpenses, from, to]);

  // Group by category for pie
  const pieData = React.useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const e of filteredExpenses) {
      byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    }
    return Object.entries(byCat).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Add Expense Form */}
          <Card>
            <CardHeader>
              <CardTitle>Add IPD Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label>Amount (PKR)</Label>
                  <Input type="number" step="0.01" placeholder="Enter amount" {...register('amount', { required: true, valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input placeholder="e.g. Supplies, Equipment, Salaries" {...register('category', { required: true })} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input placeholder="Optional description" {...register('description')} />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" {...register('date', { required: true })} />
                </div>
                <Button type="submit" disabled={isCreating}>
                  <PlusIcon className="mr-2 h-4 w-4" /> {isCreating ? 'Saving...' : 'Add Expense'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Date Filters + Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Filter & Expense Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <Label>From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <Label>To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {pieData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expense Records Table */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Records {isLoading ? '(Loading...)' : `(${filteredExpenses.length})`}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <p className="text-muted-foreground">No expenses in selected range</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredExpenses.map((expense: FinanceRecord) => (
                      <tr key={expense._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(expense.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{expense.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{expense.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{formatCurrency(expense.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline" disabled={isDeleting} onClick={() => deleteRecord(expense._id, { onSuccess: () => refetch() })}>
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IpdExpenses;
