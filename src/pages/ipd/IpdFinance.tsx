import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  useIpdFinanceRecords, 
  useIpdFinanceSummary, 
  useDeleteIpdFinanceRecord
} from '@/hooks/useIpdFinanceApi';
import { formatCurrency } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart,
  Pie,
  Cell,
  LineChart, 
  Line 
} from 'recharts';
// Uses parent IPD layout; no AdminLayout here


const IpdFinance = () => {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const { data: income = [] } = useIpdFinanceRecords('Income');
  const { data: expenses = [], refetch } = useIpdFinanceRecords('Expense');
  const { data: summary } = useIpdFinanceSummary();
  const { mutate: deleteRecord } = useDeleteIpdFinanceRecord();

  const handleDelete = (id: string) => {
    deleteRecord(id, {
      onSuccess: () => refetch()
    });
  };

  const inRange = (dateStr?: string) => {
    if (!fromDate && !toDate) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    let ok = true;
    if (fromDate) ok = ok && d >= new Date(`${fromDate}T00:00:00`);
    if (toDate) ok = ok && d <= new Date(`${toDate}T23:59:59`);
    return ok;
  };

  const filteredIncome = income.filter(r => inRange(r.date));
  const filteredExpenses = expenses.filter(r => inRange(r.date));

  const totalIncome = filteredIncome.reduce((sum, record) => sum + record.amount, 0);
  const totalExpense = filteredExpenses.reduce((sum, record) => sum + record.amount, 0);

  // Prepare data for charts
  const expenseByCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  // Build monthly income/expense for the last 6 full months (including current)
  const buildMonthlyData = () => {
    const now = new Date();
    // Keys as YYYY-MM for lookup
    const keyFor = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const labelFor = (d: Date) => d.toLocaleString(undefined, { month: 'short' });
    const months: { key: string; label: string; date: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: keyFor(d), label: labelFor(d), date: d });
    }

    const incomeByMonth: Record<string, number> = {};
    for (const r of income) {
      const d = new Date(r.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      incomeByMonth[k] = (incomeByMonth[k] || 0) + r.amount;
    }
    const expenseByMonth: Record<string, number> = {};
    for (const r of expenses) {
      const d = new Date(r.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      expenseByMonth[k] = (expenseByMonth[k] || 0) + r.amount;
    }

    return months.map(m => ({ name: m.label, income: incomeByMonth[m.key] || 0, expense: expenseByMonth[m.key] || 0 }));
  };
  const monthlyData = buildMonthlyData();

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-6 space-y-6">
        {/* Header filters */}
        <div className="flex items-center justify-end gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="border rounded-md h-9 px-2 text-sm"
          />
          <span className="text-sm text-slate-500">to</span>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="border rounded-md h-9 px-2 text-sm"
          />
          <button
            onClick={() => { setFromDate(''); setToDate(''); }}
            className="px-3 h-9 rounded-md border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
          >
            Clear
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Income Card */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-blue-800">Income</CardTitle>
              <span className="text-2xl font-bold text-blue-800">{formatCurrency(totalIncome)}</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-600">
                {filteredIncome.length} record{filteredIncome.length !== 1 ? 's' : ''} from patient billing
              </p>
            </CardContent>
          </Card>

          {/* Expenses Card */}
          <Card className="bg-gradient-to-br from-red-50 to-red-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-red-800">Expenses</CardTitle>
              <span className="text-2xl font-bold text-red-800">{formatCurrency(totalExpense)}</span>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <p className="text-sm text-red-600">
                  {filteredExpenses.length} record{filteredExpenses.length !== 1 ? 's' : ''}
                </p>
                {/* Add Expense moved to dedicated page */}
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 md:col-span-2 lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-green-800">Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-green-600">Net Balance</p>
                <div className="text-2xl font-bold text-green-800">
                  {formatCurrency((summary?.netBalance) || (totalIncome - totalExpense))}
                </div>
              </div>
              <div>
                <p className="text-sm text-green-600">This Month</p>
                <div className="text-2xl font-bold text-green-800">
                  {formatCurrency(summary?.monthlyNet || 0)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expense List */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredExpenses.length === 0 ? (
                <p className="text-muted-foreground">No expenses recorded yet</p>
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
                      {filteredExpenses.map((expense) => (
                        <tr key={expense._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(expense.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {expense.category}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {expense.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              {/* Edit moved to dedicated page */}
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleDelete(expense._id)}
                              >
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
            </div>
          </CardContent>
        </Card>

        {/* Financial Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Income vs Expense Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="income" fill="#3b82f6" name="Income" />
                  <Bar dataKey="expense" fill="#ef4444" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Expense Breakdown Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.keys(expenseByCategory).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          {/* Monthly Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#3b82f6" name="Income" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default IpdFinance;
