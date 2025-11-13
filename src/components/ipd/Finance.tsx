import React, { useMemo, useState } from 'react';
import { useAdmissions, useCreateFinanceRecord, useIpdFinanceRecords, BillingItem } from '@/hooks/useIpdApi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, CheckCircle, AlertCircle, TrendingDown, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AddExpenseDialog from './AddExpenseDialog';
import { toast } from '@/components/ui/use-toast';

// Unified transaction type
interface Transaction extends Omit<BillingItem, '_id'> {
  _id: string;
  type: 'Income' | 'Expense';
  patientName?: string;
  mrNumber?: string;
}

const IpdFinance: React.FC = () => {
  const { data: admissions = [], isLoading: admissionsLoading } = useAdmissions();
  const { data: financeRecords = [], isLoading: financeLoading } = useIpdFinanceRecords();
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const createFinanceRecordMutation = useCreateFinanceRecord();

  const handleAddExpense = (expense: { amount: number; category: string; description: string }) => {
    createFinanceRecordMutation.mutate(
      { ...expense, type: 'Expense', department: 'IPD' },
      {
        onSuccess: () => toast({ title: 'Expense Added', description: 'The new expense has been recorded successfully.' }),
        onError: (error) => toast({ title: 'Error', description: `Failed to add expense: ${error.message}`, variant: 'destructive' }),
      }
    );
  };

    const { summary, transactions, chartData } = useMemo(() => {
    const initialState = {
      summary: { revenue: 0, expenses: 0, netProfit: 0 },
      transactions: [],
      chartData: [],
    };

    if (admissionsLoading || financeLoading) return initialState;

    const incomeTransactions: Transaction[] = admissions.flatMap(admission =>
      (admission.billing || []).map(item => ({
        ...item,
        type: 'Income' as const,
        patientName: admission.patientId.name,
        mrNumber: admission.patientId.mrNumber || 'N/A',
      }))
    );

    const expenseTransactions: Transaction[] = financeRecords
      .filter(record => record.type === 'Expense' && record.department === 'IPD')
      .map(record => ({
        ...record,
        status: 'Paid', // Expenses are considered paid
      }));

    const allTransactions = [...incomeTransactions, ...expenseTransactions];

    const { revenue, expenses } = allTransactions.reduce(
      (acc, item) => {
        if (item.type === 'Expense') {
          acc.expenses += item.amount;
        } else { // Income
          acc.revenue += item.amount;
        }
        return acc;
      },
      { revenue: 0, expenses: 0 }
    );

    const summary = {
      revenue,
      expenses,
      netProfit: revenue - expenses,
    };

        const chartData = Object.values(allTransactions.reduce((acc, item) => {
      acc[item.category] = acc[item.category] || { name: item.category, revenue: 0, expenses: 0 };
      if (item.type === 'Income') {
        acc[item.category].revenue += item.amount;
      } else {
        acc[item.category].expenses += item.amount;
      }
      return acc;
    }, {} as Record<string, { name: string; revenue: number; expenses: number }>));

    return { summary, transactions: allTransactions, chartData };
  }, [admissions, financeRecords, admissionsLoading, financeLoading]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount);

    if (admissionsLoading || financeLoading) return <div className="p-4">Loading financial data...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">IPD Finance Overview</h1>
        <Button onClick={() => setIsExpenseDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.revenue)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.expenses)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit / Loss</CardTitle>
            <CheckCircle className={`h-4 w-4 ${summary.netProfit >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatCurrency(summary.netProfit)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="col-span-1 lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient/Source</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(0, 10).map((t) => (
                  <TableRow key={t._id}>
                    <TableCell>
                      <div className="font-medium">{t.patientName || 'General Expense'}</div>
                      <div className="text-sm text-muted-foreground">{t.mrNumber}</div>
                    </TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell>{t.category}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.type === 'Income' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{t.type}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {t.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={formatCurrency} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <AddExpenseDialog 
        open={isExpenseDialogOpen} 
        onOpenChange={setIsExpenseDialogOpen} 
        onSubmit={handleAddExpense} 
      />
    </div>
  );
};

export default IpdFinance;

