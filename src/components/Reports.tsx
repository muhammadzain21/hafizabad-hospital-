import React, { useState, useEffect } from 'react';
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { TrendingUp, DollarSign, Calendar, Users, FileText, BarChart3, ChevronRight, ArrowUp, ArrowDown, Plus, Download, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDoctors, useTokens } from '@/hooks/useApi';
import { useIpdAdmissionsFull, useIpdFinanceRecords } from '@/hooks/useIpdApi';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart, Line } from 'recharts';

interface FinancialData {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalTokens: number;
  averageFee: number;
  departmentBreakdown: { [key: string]: number };
  monthlyData: { month: string; revenue: number; expenses: number; }[];
}

interface MonthlyDetail {
  date: string;
  description: string;
  amount: number;
  type: 'revenue' | 'expense';
}

type ReportsProps = { initialTab?: 'doctor' | 'dashboard' | 'department' | 'trend' | 'expenses' };

const Reports: React.FC<ReportsProps> = ({ initialTab = 'doctor' }) => {
  const [tab, setTab] = useState<ReportsProps['initialTab']>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [dateView, setDateView] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // for day/week
  const [selectedMonthDetails, setSelectedMonthDetails] = useState<string | null>(null);
  const [monthlyDetails, setMonthlyDetails] = useState<MonthlyDetail[]>([]);
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    totalTokens: 0,
    averageFee: 0,
    departmentBreakdown: {},
    monthlyData: []
  });
  const [filteredFinancialData, setFilteredFinancialData] = useState<FinancialData>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    totalTokens: 0,
    averageFee: 0,
    departmentBreakdown: {},
    monthlyData: []
  });
  // All month expenses for KPIs/charts (small volume acceptable). If performance becomes an issue, replace with aggregate API.
  const [expenses, setExpenses] = useState<any[]>([]);
  // Server-side pagination for list
  const [pageExpenses, setPageExpenses] = useState<any[]>([]);
  const [expTotal, setExpTotal] = useState(0);
  const [expPage, setExpPage] = useState(1);
  const EXP_PAGE_SIZE = 10;
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: 0,
    category: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  // New: optional custom date/time range filter applied across reports
  const [useRange, setUseRange] = useState(false);
  const [rangeFromDate, setRangeFromDate] = useState<string>(''); // YYYY-MM-DD
  const [rangeFromTime, setRangeFromTime] = useState<string>(''); // HH:MM
  const [rangeToDate, setRangeToDate] = useState<string>('');
  const [rangeToTime, setRangeToTime] = useState<string>('');

  // Derived expense data for visualizations (current month/year)
  const filteredExpensesForMonth = expenses.filter((expense: any) => {
    const d = new Date(expense.date);
    return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
  });
  const totalMonthExpenses = filteredExpensesForMonth.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
  const categoryMap = new Map<string, number>();
  filteredExpensesForMonth.forEach((e: any) => {
    const key = (e.category || 'Uncategorized').toString();
    categoryMap.set(key, (categoryMap.get(key) || 0) + (e.amount || 0));
  });
  const categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  const dailyMap = new Map<string, number>();
  filteredExpensesForMonth.forEach((e: any) => {
    const key = new Date(e.date).toLocaleDateString();
    dailyMap.set(key, (dailyMap.get(key) || 0) + (e.amount || 0));
  });
  const dailyData = Array.from(dailyMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const avgPerExpense = filteredExpensesForMonth.length > 0 ? Math.round(totalMonthExpenses / filteredExpensesForMonth.length) : 0;
  const EXPENSE_COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#22c55e','#06b6d4','#eab308'];

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const expenseCategories = [
    'Medical Supplies',
    'Equipment',
    'Utilities',
    'Staff Salary',
    'Maintenance',
    'Administrative',
    'Other'
  ];

  // IPD data sources (must be declared before effects that depend on them)
  const { data: ipdAdmissions = [] } = useIpdAdmissionsFull();
  const { data: ipdFinance = [] } = useIpdFinanceRecords();

  useEffect(() => {
    loadExpenses();
  }, [selectedMonth, selectedYear, expPage]);

  useEffect(() => {
    setExpPage(1);
  }, [selectedMonth, selectedYear, expenses]);

  const [revenueTick, setRevenueTick] = useState(0);
  useEffect(() => {
    const onRevenueChanged = () => setRevenueTick(t => t + 1);
    window.addEventListener('revenueChanged', onRevenueChanged);
    return () => window.removeEventListener('revenueChanged', onRevenueChanged);
  }, []);
  useEffect(() => {
    calculateFinancialData();
  }, [selectedMonth, selectedYear, dateView, selectedDate, expenses, ipdAdmissions, ipdFinance, revenueTick]);

  const loadExpenses = async () => {
    try {
      // Month is 0-indexed in state, server expects 1-12
      const month = (parseInt(selectedMonth, 10) + 1).toString();
      const year = selectedYear;
      // 1) Fetch paginated list for history
      const resPaged = await fetch(`/api/expenses?month=${month}&year=${year}&page=${expPage}&limit=${EXP_PAGE_SIZE}`);
      if (!resPaged.ok) throw new Error('Failed to load expenses (paged)');
      const jsonPaged = await resPaged.json();
      if (Array.isArray(jsonPaged?.data)) {
        setPageExpenses(jsonPaged.data);
        setExpTotal(Number(jsonPaged.total || 0));
      } else {
        setPageExpenses(Array.isArray(jsonPaged) ? jsonPaged : []);
        setExpTotal(Array.isArray(jsonPaged) ? jsonPaged.length : 0);
      }

      // 2) Fetch full month list for KPIs/charts (back-compat when no aggregation endpoint)
      const resAll = await fetch(`/api/expenses?month=${month}&year=${year}`);
      if (!resAll.ok) throw new Error('Failed to load expenses (all)');
      const all = await resAll.json();
      setExpenses(Array.isArray(all) ? all : []);
    } catch (e) {
      console.error('loadExpenses error', e);
      setPageExpenses([]);
      setExpenses([]);
      setExpTotal(0);
    }
  };

  // IPD sources already declared above

  const calculateFinancialData = () => {
    const tokens = Array.isArray(tokensData) ? tokensData : [];
    const expensesList = expenses || [];

    // Build a function to test if a Date falls within optional custom range
    const inRange = (d: Date) => {
      if (!useRange) return true;
      let fromOk = true, toOk = true;
      if (rangeFromDate) {
        const from = new Date(`${rangeFromDate}T${rangeFromTime || '00:00'}:00`);
        fromOk = d >= from;
      }
      if (rangeToDate) {
        const to = new Date(`${rangeToDate}T${rangeToTime || '23:59'}:59`);
        toOk = d <= to;
      }
      return fromOk && toOk;
    };

    let filteredTokens = Array.isArray(tokensData) ? tokensData : [];
    // Helper to filter IPD billing items by the same view/range
    const filterByView = (dateStr: string) => {
      const d = new Date(dateStr);
      if (useRange && (rangeFromDate || rangeToDate)) return inRange(d);
      if (dateView === 'day') {
        const target = new Date(selectedDate);
        return d.toDateString() === target.toDateString();
      }
      if (dateView === 'week') {
        const target = new Date(selectedDate);
        const startOfWeek = new Date(target);
        startOfWeek.setDate(target.getDate() - target.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        return d >= startOfWeek && d <= endOfWeek;
      }
      if (dateView === 'month') {
        return d.getMonth() === parseInt(selectedMonth) && d.getFullYear() === parseInt(selectedYear);
      }
      if (dateView === 'year') {
        return d.getFullYear() === parseInt(selectedYear);
      }
      return true;
    };
    if (useRange && (rangeFromDate || rangeToDate)) {
      filteredTokens = tokens.filter((token: any) => inRange(new Date(token.dateTime)));
    } else if (dateView === 'day') {
      const target = new Date(selectedDate);
      filteredTokens = tokens.filter((token: any) => {
        const tokenDate = new Date(token.dateTime);
        return tokenDate.toDateString() === target.toDateString();
      });
    } else if (dateView === 'week') {
      const target = new Date(selectedDate);
      const startOfWeek = new Date(target);
      startOfWeek.setDate(target.getDate() - target.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      filteredTokens = tokens.filter((token: any) => {
        const tokenDate = new Date(token.dateTime);
        return tokenDate >= startOfWeek && tokenDate <= endOfWeek;
      });
    } else if (dateView === 'month') {
      filteredTokens = tokens.filter((token: any) => {
        const tokenDate = new Date(token.dateTime);
        return tokenDate.getMonth() === parseInt(selectedMonth) && tokenDate.getFullYear() === parseInt(selectedYear);
      });
    } else if (dateView === 'year') {
      filteredTokens = tokens.filter((token: any) => {
        const tokenDate = new Date(token.dateTime);
        return tokenDate.getFullYear() === parseInt(selectedYear);
      });
    }

    // Calculate revenue from tokens (OPD) excluding returned tokens and subtracting refunds if present
    const opdRevenue = filteredTokens.reduce((sum: number, token: any) => {
      const isReturned = String(token?.status || '').toLowerCase() === 'returned';
      const refundAmount = Number(token?.refundAmount || 0) || 0;
      const base = Number(token?.finalFee || 0) || 0;
      if (isReturned) return sum;
      return sum + Math.max(0, base - refundAmount);
    }, 0);

    // Calculate revenue from IPD admissions billing (treat only Paid as income) - robust status/date
    const ipdIncomeItems: Array<{ amount: number; date: string }> = [];
    (Array.isArray(ipdAdmissions) ? ipdAdmissions : []).forEach((adm: any) => {
      (adm.billing || []).forEach((bi: any) => {
        if (!bi) return;
        const status = String(bi.status || '').toLowerCase();
        const dateStr = String(bi.date || adm.admitDateTime || new Date().toISOString());
        if (status === 'paid' && filterByView(dateStr)) {
          ipdIncomeItems.push({ amount: Number(bi.amount) || 0, date: dateStr });
        }
      });
    });
    const ipdRevenue = ipdIncomeItems.reduce((acc, it) => acc + (it.amount || 0), 0);

    // Include IPD Finance records with type 'Income' but EXCLUDE those tied to an admission
    // because Paid IPD billing items are already counted above from admissions.
    const filteredIpdFinanceIncome = (Array.isArray(ipdFinance) ? ipdFinance : []).filter((r: any) => {
      if (String(r.type) !== 'Income') return false;
      if (String(r.department) !== 'IPD') return false;
      if (r.admissionId) return false; // avoid double counting with IPD billing Paid items
      return filterByView(String(r.date));
    });
    const ipdFinanceRevenue = filteredIpdFinanceIncome.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

    const totalRevenue = opdRevenue + ipdRevenue + ipdFinanceRevenue;

    // Filter general expenses by the same view
    const filteredExpenses = (expenses as any[]).filter((expense: any) => {
      const expenseDate = new Date(expense.date);
      if (useRange && (rangeFromDate || rangeToDate)) return inRange(expenseDate);
      return expenseDate.getMonth() === parseInt(selectedMonth) && expenseDate.getFullYear() === parseInt(selectedYear);
    });

    // Add IPD expenses from IPD finance records
    const filteredIpdExpenses = (Array.isArray(ipdFinance) ? ipdFinance : []).filter((r: any) => {
      if ((r.type || '') !== 'Expense' || (r.department || '') !== 'IPD') return false;
      return filterByView(r.date);
    });
    const totalExpenses = filteredExpenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0)
      + filteredIpdExpenses.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);

    // Department breakdown (add IPD bucket)
    const departmentBreakdown: { [key: string]: number } = {};
    filteredTokens.forEach((token: any) => {
      const isReturned = String(token?.status || '').toLowerCase() === 'returned';
      if (isReturned) return;
      const refundAmount = Number(token?.refundAmount || 0) || 0;
      const base = Number(token?.finalFee || 0) || 0;
      const dept = token.department || 'Unknown';
      departmentBreakdown[dept] = (departmentBreakdown[dept] || 0) + Math.max(0, base - refundAmount);
    });
    departmentBreakdown['IPD'] = (departmentBreakdown['IPD'] || 0) + ipdRevenue;

    // Monthly data for the year (combine OPD + IPD revenue and all expenses)
    const monthlyData = months.map((month, index) => {
      const monthTokens = tokens.filter((token: any) => {
        const tokenDate = new Date(token.dateTime);
        return tokenDate.getMonth() === index && tokenDate.getFullYear() === parseInt(selectedYear);
      });
      
      const monthExpenses = expenses.filter((expense: any) => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === index && expenseDate.getFullYear() === parseInt(selectedYear);
      });
      // IPD monthly revenue (Paid billing items)
      const monthIpdRevenue = (Array.isArray(ipdAdmissions) ? ipdAdmissions : []).reduce((acc: number, adm: any) => {
        return acc + (adm.billing || []).reduce((s: number, bi: any) => {
          if (!bi) return s;
          const d = new Date(bi.date || adm.admitDateTime || new Date());
          const paid = String(bi.status || '').toLowerCase() === 'paid';
          return s + (paid && d.getMonth() === index && d.getFullYear() === parseInt(selectedYear) ? (Number(bi.amount) || 0) : 0);
        }, 0);
      }, 0);
      // IPD monthly revenue from Finance 'Income' records (excluding those tied to an admission)
      const monthIpdFinanceIncome = (Array.isArray(ipdFinance) ? ipdFinance : []).reduce((acc: number, r: any) => {
        const d = new Date(r.date);
        const ok = String(r.type) === 'Income' && String(r.department) === 'IPD' && !r.admissionId && d.getMonth() === index && d.getFullYear() === parseInt(selectedYear);
        return acc + (ok ? (Number(r.amount) || 0) : 0);
      }, 0);
      // IPD monthly expenses
      const monthIpdExpense = (Array.isArray(ipdFinance) ? ipdFinance : []).reduce((acc: number, r: any) => {
        const d = new Date(r.date);
        const ok = (r.type === 'Expense') && (r.department === 'IPD') && d.getMonth() === index && d.getFullYear() === parseInt(selectedYear);
        return acc + (ok ? (Number(r.amount) || 0) : 0);
      }, 0);

      const monthRevenue = monthTokens.reduce((sum: number, token: any) => {
        const isReturned = String(token?.status || '').toLowerCase() === 'returned';
        const refundAmount = Number(token?.refundAmount || 0) || 0;
        const base = Number(token?.finalFee || 0) || 0;
        if (isReturned) return sum;
        return sum + Math.max(0, base - refundAmount);
      }, 0) + monthIpdRevenue + monthIpdFinanceIncome;
      const monthExpenseTotal = monthExpenses.reduce((sum: number, expense: any) => sum + (expense.amount || 0), 0) + monthIpdExpense;

      return {
        month: month.substring(0, 3),
        revenue: monthRevenue,
        expenses: monthExpenseTotal
      };
    });

    setFinancialData({
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      totalTokens: filteredTokens.length,
      averageFee: filteredTokens.length > 0 ? totalRevenue / filteredTokens.length : 0,
      departmentBreakdown,
      monthlyData
    });
    // Keep filteredFinancialData in sync so Monthly Trend renders
    setFilteredFinancialData({
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      totalTokens: filteredTokens.length,
      averageFee: filteredTokens.length > 0 ? totalRevenue / filteredTokens.length : 0,
      departmentBreakdown,
      monthlyData
    });
  };

  const showMonthDetails = (monthIndex: number) => {
    const tokens = Array.isArray(tokensData) ? tokensData : [];
    const expenses = Array.isArray((window as any)?.expenses) ? (window as any).expenses : [];
    
    const monthTokens = tokens.filter((token: any) => {
      const tokenDate = new Date(token.dateTime);
      return tokenDate.getMonth() === monthIndex && tokenDate.getFullYear() === parseInt(selectedYear);
    });
    
    const monthExpenses = expenses.filter((expense: any) => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === monthIndex && expenseDate.getFullYear() === parseInt(selectedYear);
    });
    const monthIpdExpenses = ipdFinance.filter((r: any) => (r.type === 'Expense') && (r.department === 'IPD'))
      .filter((r: any) => {
        const d = new Date(r.date);
        return d.getMonth() === monthIndex && d.getFullYear() === parseInt(selectedYear);
      });

    const details: MonthlyDetail[] = [
      ...monthTokens.filter((t: any) => String(t?.status || '').toLowerCase() !== 'returned').map((token: any) => ({
        date: new Date(token.dateTime).toLocaleDateString(),
        description: `Token #${token.tokenNumber} - ${token.patientName}`,
        amount: (Number(token.finalFee || 0) || 0) - (Number(token.refundAmount || 0) || 0),
        type: 'revenue' as const
      })),
      // IPD incomes (Paid billing items)
      ...((Array.isArray(ipdAdmissions) ? ipdAdmissions : []).flatMap((adm: any) => (
        (adm.billing || [])
          .filter((bi: any) => {
            const d = new Date(bi.date || adm.admitDateTime || new Date());
            const paid = String(bi.status || '').toLowerCase() === 'paid';
            return paid && d.getMonth() === monthIndex && d.getFullYear() === parseInt(selectedYear);
          })
          .map((bi: any) => ({
            date: new Date(bi.date || adm.admitDateTime || new Date()).toLocaleDateString(),
            description: `IPD Billing - ${bi.description || 'Service'}`,
            amount: Number(bi.amount) || 0,
            type: 'revenue' as const
          }))
      ))),
      // IPD incomes from Finance records (excluding those tied to an admission)
      ...((Array.isArray(ipdFinance) ? ipdFinance : [])
        .filter((r: any) => String(r.type) === 'Income' && String(r.department) === 'IPD' && !r.admissionId)
        .filter((r: any) => {
          const d = new Date(r.date);
          return d.getMonth() === monthIndex && d.getFullYear() === parseInt(selectedYear);
        })
        .map((r: any) => ({
          date: new Date(r.date).toLocaleDateString(),
          description: r.description || 'IPD Income',
          amount: Number(r.amount) || 0,
          type: 'revenue' as const,
        }))
      ),
      ...monthExpenses.map((expense: any) => ({
        date: new Date(expense.date).toLocaleDateString(),
        description: expense.description || 'Expense',
        amount: expense.amount || 0,
        type: 'expense' as const
      })),
      ...monthIpdExpenses.map((r: any) => ({
        date: new Date(r.date).toLocaleDateString(),
        description: r.description || 'IPD Expense',
        amount: Number(r.amount) || 0,
        type: 'expense' as const
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setMonthlyDetails(details);
    setSelectedMonthDetails(months[monthIndex]);
  };

  const addExpense = async (expenseData?: any) => {
    const payload = expenseData || {
      title: expenseForm.description || 'Expense',
      description: expenseForm.description,
      amount: parseFloat(String(expenseForm.amount || 0)),
      category: expenseForm.category,
      date: expenseForm.date,
    };
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to add expense');
      if (!expenseData) {
        setExpenseForm({
          description: '',
          amount: 0,
          category: '',
          date: new Date().toISOString().split('T')[0]
        });
      }
      await loadExpenses();
      calculateFinancialData();
    } catch (e) {
      console.error('addExpense error', e);
      alert('Failed to add expense');
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete expense');
      await loadExpenses();
      calculateFinancialData();
    } catch (e) {
      console.error('deleteExpense error', e);
      alert('Failed to delete expense');
    }
  };

  const exportExpensesToCSV = () => {
    const monthExpenses = expenses.filter((expense: any) => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === parseInt(selectedMonth) && 
             expenseDate.getFullYear() === parseInt(selectedYear);
    });

    if (monthExpenses.length === 0) {
      alert('No expenses found for the selected month');
      return;
    }

    const csvContent = [
      ['Date', 'Description', 'Category', 'Amount'],
      ...monthExpenses.map((expense: any) => [
        new Date(expense.date).toLocaleDateString(),
        expense.description,
        expense.category || 'Uncategorized',
        expense.amount
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-${months[parseInt(selectedMonth)]}-${selectedYear}.csv`;
    link.click();
  };

  const importExpensesFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const lines = csvContent.split('\n');
      const header = lines[0].split(',');
      
      const importedExpenses = lines.slice(1).map((line, index) => {
        const values = line.split(',');
        if (values.length >= 4 && values[0].trim()) {
          return {
            id: Date.now() + index,
            date: new Date(values[0].trim()).toISOString().split('T')[0],
            description: values[1].trim(),
            category: values[2].trim() || 'Imported',
            amount: parseFloat(values[3].trim()) || 0
          };
        }
        return null;
      }).filter(Boolean);

      importedExpenses.forEach(expense => {
        if (expense) addExpense(expense);
      });

      alert(`Imported ${importedExpenses.length} expenses successfully`);
    };
    reader.readAsText(file);
  };

  const exportReport = () => {
    const tokens = Array.isArray(tokensData) ? tokensData : [];
    const monthTokens = tokens.filter((token: any) => {
      const tokenDate = new Date(token.dateTime);
      return tokenDate.getMonth() === parseInt(selectedMonth) && 
             tokenDate.getFullYear() === parseInt(selectedYear);
    });

    const monthExpenses = expenses.filter((expense: any) => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === parseInt(selectedMonth) && 
             expenseDate.getFullYear() === parseInt(selectedYear);
    });

    const reportData = {
      period: `${months[parseInt(selectedMonth)]} ${selectedYear}`,
      summary: {
        ...financialData,
        totalTokens: monthTokens.length
      },
      transactions: {
        revenue: monthTokens.map((token: any) => ({
          date: new Date(token.dateTime).toLocaleDateString(),
          description: `Token #${token.tokenNumber} - ${token.patientName}`,
          amount: token.finalFee || 0,
          department: token.department
        })),
        expenses: monthExpenses.map((expense: any) => ({
          date: new Date(expense.date).toLocaleDateString(),
          description: expense.description,
          category: expense.category,
          amount: expense.amount
        }))
      },
      generatedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial-report-${selectedYear}-${String(parseInt(selectedMonth) + 1).padStart(2, '0')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- Doctor-wise Revenue Calculation ---
  // Load from backend hooks instead of localStorage
  const { data: doctorsData = [] } = useDoctors();
  // Build quick lookup for active doctors (by id and by normalized name)
  const activeDoctors: any[] = Array.isArray(doctorsData) ? doctorsData : [];
  const activeDoctorIds = new Set<string>(
    activeDoctors.map((d: any) => String(d?.id || d?._id || '')).filter(Boolean)
  );
  const activeDoctorNames = new Set<string>(
    activeDoctors.map((d: any) => (d?.name || '').toString().trim().toLowerCase()).filter(Boolean)
  );
  const { data: tokensData = [] } = useTokens();

  // Recalculate when tokens data changes (declared after tokensData exists)
  useEffect(() => {
    calculateFinancialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensData]);

  // Filter tokens for current view (for doctor-wise cards)
  // Respect custom range if enabled
  let filteredTokens = Array.isArray(tokensData) ? tokensData : [];
  const rangeActive = useRange && (rangeFromDate || rangeToDate);
  const withinRange = (d: Date) => {
    let ok = true;
    if (rangeFromDate) ok = ok && d >= new Date(`${rangeFromDate}T${rangeFromTime || '00:00'}:00`);
    if (rangeToDate) ok = ok && d <= new Date(`${rangeToDate}T${rangeToTime || '23:59'}:59`);
    return ok;
  };
  if (rangeActive) {
    filteredTokens = filteredTokens.filter((t: any) => withinRange(new Date(t.dateTime)));
  } else if (dateView === 'day') {
    const target = new Date(selectedDate);
    filteredTokens = filteredTokens.filter((token: any) => {
      const tokenDate = new Date(token.dateTime);
      return tokenDate.toDateString() === target.toDateString();
    });
  } else if (dateView === 'week') {
    const target = new Date(selectedDate);
    const startOfWeek = new Date(target);
    startOfWeek.setDate(target.getDate() - target.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    filteredTokens = filteredTokens.filter((token: any) => {
      const tokenDate = new Date(token.dateTime);
      return tokenDate >= startOfWeek && tokenDate <= endOfWeek;
    });
  } else if (dateView === 'month') {
    filteredTokens = filteredTokens.filter((token: any) => {
      const tokenDate = new Date(token.dateTime);
      return tokenDate.getMonth() === parseInt(selectedMonth) && tokenDate.getFullYear() === parseInt(selectedYear);
    });
  } else if (dateView === 'year') {
    filteredTokens = filteredTokens.filter((token: any) => {
      const tokenDate = new Date(token.dateTime);
      return tokenDate.getFullYear() === parseInt(selectedYear);
    });
  }

  // --- Doctor-wise Revenue Filtering, Sorting, and Search ---
  const [doctorSearch, setDoctorSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'revenue' | 'patients'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const handleSort = (field: 'name' | 'revenue' | 'patients') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };
  
  const doctorRevenueMap: { [doctorId: string]: { name: string; revenue: number; patients: number } } = {};
  // Prefill with ACTIVE doctors only
  activeDoctors.forEach((d: any) => {
    const id = String(d?.id || d?._id);
    const name = d?.name || 'Unknown';
    if (id && !doctorRevenueMap[id]) doctorRevenueMap[id] = { name, revenue: 0, patients: 0 };
  });
  // Aggregate from filtered tokens for the selected period
  filteredTokens.forEach((token: any) => {
    const isReturned = String(token?.status || '').toLowerCase() === 'returned';
    if (isReturned) return;
    const allDocs = activeDoctors;
    let doctorKey: string | undefined = token.doctorId || token.doctorId?._id;
    let doctorName: string | undefined;

    // Resolve by ID if present and active
    if (doctorKey && !activeDoctorIds.has(String(doctorKey))) {
      doctorKey = undefined;
    }

    // If no valid active ID, try to match by active doctor name
    if (!doctorKey) {
      const rawName: string = typeof token.doctor === 'string' ? token.doctor : '';
      const cleanName = rawName.replace(/^Dr\.?\s*/i, '').split(' - ')[0].trim().toLowerCase();
      if (!cleanName || !activeDoctorNames.has(cleanName)) {
        return; // skip tokens for deleted/inactive/unknown doctors
      }
      const matched = allDocs.find((d: any) => (d.name || '').toString().trim().toLowerCase() === cleanName);
      if (matched) {
        doctorKey = String(matched.id || matched._id);
        doctorName = matched.name;
      } else {
        return;
      }
    } else {
      const byId = allDocs.find((d: any) => String(d.id || d._id) === String(doctorKey));
      doctorName = byId?.name;
    }

    if (!doctorKey) return;
    if (!doctorRevenueMap[doctorKey]) {
      doctorRevenueMap[doctorKey] = { name: doctorName || 'Unknown', revenue: 0, patients: 0 };
    } else if (!doctorRevenueMap[doctorKey].name && doctorName) {
      doctorRevenueMap[doctorKey].name = doctorName;
    }
    const consultationFee = parseFloat(token.fee) || parseFloat(token.consultationFee) || parseFloat(token.finalFee) || 0;
    doctorRevenueMap[doctorKey].revenue += isNaN(consultationFee) ? 0 : consultationFee;
    doctorRevenueMap[doctorKey].patients += 1;
  });
  // Only show active doctors in the cards
  let doctorRevenueArr = Object.values(doctorRevenueMap);
  // Apply search filter
  if (doctorSearch.trim()) {
    doctorRevenueArr = doctorRevenueArr.filter(doc => doc.name.toLowerCase().includes(doctorSearch.toLowerCase()));
  }
  // Apply sorting
  const sortedDoctorRevenueArr = [...doctorRevenueArr].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortBy === 'revenue') {
      cmp = a.revenue - b.revenue;
    } else if (sortBy === 'patients') {
      cmp = a.patients - b.patients;
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const applyDateFilter = () => {
    // Sync filteredFinancialData with the latest computed financialData
    setFilteredFinancialData(financialData);
  };

  

return (
  <div className="flex flex-col gap-6 min-h-screen w-full px-2 md:px-4 py-4 overflow-x-hidden">
    <Tabs value={tab} onValueChange={(v:any)=>setTab(v)} className="flex-1 flex flex-col min-h-0 min-w-0">
      <TabsList className="w-full justify-start flex flex-nowrap gap-2 md:gap-3 overflow-x-auto">
        <TabsTrigger value="doctor" className="px-3 py-2 md:px-4 md:py-2 text-sm md:text-base font-semibold whitespace-nowrap rounded-lg">Doctors</TabsTrigger>
        <TabsTrigger value="dashboard" className="px-3 py-2 md:px-4 md:py-2 text-sm md:text-base font-semibold whitespace-nowrap rounded-lg">Dashboard</TabsTrigger>
        <TabsTrigger value="trend" className="px-3 py-2 md:px-4 md:py-2 text-sm md:text-base font-semibold whitespace-nowrap rounded-lg">Trend</TabsTrigger>
        <TabsTrigger value="expenses" className="px-3 py-2 md:px-4 md:py-2 text-sm md:text-base font-semibold whitespace-nowrap rounded-lg">Expenses</TabsTrigger>
      </TabsList>

      {/* Global Date/Time Range Filters */}
      {tab !== 'dashboard' && (
        <div className="mt-3 mb-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={useRange} onChange={e=>setUseRange(e.target.checked)} />
              Use custom date/time range
            </label>
            <div className="flex items-center gap-1">
              <input type="date" value={rangeFromDate} onChange={e=>setRangeFromDate(e.target.value)} className="border rounded-md h-9 px-2 text-sm" />
              <input type="time" value={rangeFromTime} onChange={e=>setRangeFromTime(e.target.value)} className="border rounded-md h-9 px-2 text-sm w-[110px]" />
            </div>
            <span className="text-sm text-slate-500">to</span>
            <div className="flex items-center gap-1">
              <input type="date" value={rangeToDate} onChange={e=>setRangeToDate(e.target.value)} className="border rounded-md h-9 px-2 text-sm" />
              <input type="time" value={rangeToTime} onChange={e=>setRangeToTime(e.target.value)} className="border rounded-md h-9 px-2 text-sm w-[110px]" />
            </div>
            <button
              onClick={()=>{ /* state updates already trigger recalculation */ calculateFinancialData(); }}
              className="ml-auto md:ml-0 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
            >
              Apply
            </button>
            <button
              onClick={()=>{ setUseRange(false); setRangeFromDate(''); setRangeFromTime(''); setRangeToDate(''); setRangeToTime(''); calculateFinancialData(); }}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
            >
              Clear
            </button>
          </div>
          {useRange && (rangeFromDate || rangeToDate) && (
            <div className="mt-2 text-xs text-slate-600">
              Active range: {rangeFromDate || '—'} {rangeFromTime || ''} → {rangeToDate || '—'} {rangeToTime || ''}
            </div>
          )}
        </div>
      )}

      {/* Doctor-wise Revenue Summary */}
      <TabsContent value="doctor">
        <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-50 to-blue-50 rounded-3xl w-full overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-emerald-400 to-blue-400 text-white rounded-t-3xl p-4">
            <CardTitle className="flex items-center space-x-3 text-lg">
              <TrendingUp className="h-6 w-6" />
              <span>Doctor-wise Revenue & Patient Count</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 overflow-x-hidden">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
              <Input
                type="text"
                placeholder="Search doctor name..."
                className="w-full md:w-64 border-emerald-300 focus:border-emerald-500"
                value={doctorSearch}
                onChange={e => setDoctorSearch(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className={sortBy === 'name' ? 'border-emerald-600 text-emerald-700' : ''} onClick={() => handleSort('name')}>
                  Doctor {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />)}
                </Button>
                <Button variant="outline" size="sm" className={sortBy === 'revenue' ? 'border-green-600 text-green-700' : ''} onClick={() => handleSort('revenue')}>
                  Revenue {sortBy === 'revenue' && (sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />)}
                </Button>
                <Button variant="outline" size="sm" className={sortBy === 'patients' ? 'border-blue-600 text-blue-700' : ''} onClick={() => handleSort('patients')}>
                  Patients {sortBy === 'patients' && (sortOrder === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />)}
                </Button>
              </div>
            </div>
            {sortedDoctorRevenueArr.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-xl">No doctor revenue data for this period</p>
              </div>
            ) : (
              (() => {
                const metaByName = new Map(
                  (Array.isArray(doctorsData) ? doctorsData : []).map((d: any) => [
                    (d?.name || '').toString().trim().toLowerCase(),
                    d,
                  ])
                );
                const today = new Date();
                today.setHours(0,0,0,0);
                const profiles = sortedDoctorRevenueArr.map((doc) => {
                  const meta = metaByName.get(doc.name.toLowerCase());
                  const commissionRate = typeof meta?.commissionRate === 'number' ? meta.commissionRate : 0;
                  const consultationFee = typeof meta?.consultationFee === 'number' ? meta.consultationFee : 0;
                  // Count today's tokens for this doctor (best-effort by name)
                  const todayCount = (Array.isArray(tokensData) ? tokensData : []).filter((t: any) => {
                    const tDate = new Date(t.dateTime);
                    const sameDay = tDate.getFullYear() === today.getFullYear() && tDate.getMonth() === today.getMonth() && tDate.getDate() === today.getDate();
                    const tName = (typeof t.doctor === 'string' ? t.doctor : '').replace(/^Dr\.?\s*/i, '').split(' - ')[0].trim().toLowerCase();
                    return sameDay && tName === doc.name.toLowerCase();
                  }).length;
                  return {
                    name: doc.name,
                    specialization: meta?.specialization || '',
                    revenue: doc.revenue,
                    patients: doc.patients,
                    commissionRate,
                    commission: Math.round((doc.revenue || 0) * (commissionRate / 100)),
                    consultationFee,
                    phone: meta?.phone || '-',
                    email: meta?.email || '-',
                    today: todayCount,
                  };
                });
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {profiles.map((p) => (
                      <div key={p.name} className="bg-white rounded-2xl shadow-md border border-emerald-100 overflow-hidden">
                        <div className="p-4 flex items-start justify-between">
                          <div>
                            <div className="font-bold text-lg text-slate-800">Dr. {p.name}</div>
                            <div className="text-xs text-slate-500">{p.specialization}</div>
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-emerald-50 rounded-xl p-3">
                              <div className="text-xs text-emerald-600 font-semibold">Revenue</div>
                              <div className="text-lg font-bold text-emerald-700">Rs. {p.revenue.toLocaleString()}</div>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3">
                              <div className="text-xs text-blue-600 font-semibold">Commission</div>
                              <div className="text-lg font-bold text-blue-700">Rs. {p.commission.toLocaleString()}</div>
                            </div>
                            <div className="bg-violet-50 rounded-xl p-3">
                              <div className="text-xs text-violet-600 font-semibold">Patients</div>
                              <div className="text-lg font-bold text-violet-700">{p.patients}</div>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-3">
                              <div className="text-xs text-orange-600 font-semibold">Today</div>
                              <div className="text-lg font-bold text-orange-700">{p.today}</div>
                            </div>
                          </div>
                          <div className="text-xs text-slate-600 space-y-1">
                            <div><span className="font-semibold">Fee:</span> Rs. {p.consultationFee.toLocaleString()}</div>
                            <div><span className="font-semibold">Commission:</span> {p.commissionRate}%</div>
                            <div><span className="font-semibold">Phone:</span> {p.phone}</div>
                            <div><span className="font-semibold">Email:</span> {p.email}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Financial Reports Dashboard */}
      <TabsContent value="dashboard">
        {/* Period selectors and quick actions removed for Dashboard view */}
        {/* Dashboard KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl border border-emerald-200 p-4">
            <div className="text-emerald-600 font-semibold text-sm">Total Revenue</div>
            <div className="text-3xl font-bold text-emerald-700">Rs. {financialData.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-pink-100 rounded-2xl border border-red-200 p-4">
            <div className="text-red-600 font-semibold text-sm">Total Expenses</div>
            <div className="text-3xl font-bold text-red-700">Rs. {financialData.totalExpenses.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl border border-blue-200 p-4">
            <div className="text-blue-600 font-semibold text-sm">Net Income</div>
            <div className={`text-3xl font-bold ${financialData.netIncome >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Rs. {financialData.netIncome.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl border border-violet-200 p-4">
            <div className="text-violet-600 font-semibold text-sm">Total Patients</div>
            <div className="text-3xl font-bold text-violet-700">{financialData.totalTokens}</div>
          </div>
        </div>
        {/* Department Revenue widgets: grid aligned with KPI row sizes */}
        <div className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
            {Object.entries(financialData.departmentBreakdown).map(([dept, revenue]) => (
              <div key={dept} className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 min-h-[92px] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-800 text-base">{dept}</span>
                  <span className="font-bold text-slate-900 text-lg">Rs. {revenue.toLocaleString()}</span>
                </div>
                <div className="w-full bg-indigo-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${financialData.totalRevenue > 0 ? (Number(revenue) / financialData.totalRevenue) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-slate-600 text-xs mt-2 font-medium">
                  {financialData.totalRevenue > 0 ? ((Number(revenue) / financialData.totalRevenue) * 100).toFixed(1) : 0}% of total revenue
                </p>
              </div>
            ))}
          </div>
        </div>
        {/* Yearly trend on dashboard */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mt-4">
          <div className="font-semibold text-gray-700 mb-2">Revenue vs Expenses with Net Income (Yearly)</div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filteredFinancialData.monthlyData.map(md => ({
                month: md.month,
                revenue: md.revenue,
                expenses: md.expenses,
                net: md.revenue - md.expenses,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[6,6,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[6,6,0,0]} />
                <Line type="monotone" dataKey="net" name="Net Income" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        

        

        
      </TabsContent>

      

        


        {/* Monthly Trend */}
        <TabsContent value="trend">
          <Card className="border-none shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <CardTitle className="text-2xl font-bold">Monthly Trend for {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                {filteredFinancialData.monthlyData.map((month, index) => (
                  <div 
                    key={`month-card-${month.month}-${index}`} 
                    className={`flex items-center justify-between p-3 md:p-4 rounded-xl border-l-4 ${
                      month.revenue > month.expenses 
                        ? 'bg-green-50 border-green-500' 
                        : 'bg-red-50 border-red-500'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-base md:text-lg">{month.month}</p>
                      <p className="text-gray-600 text-sm md:text-base">{selectedYear}</p>
                    </div>
                    <div className="space-y-2.5 md:space-y-3">
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-green-600 font-semibold text-sm md:text-base">Revenue:</span>
                        <span className="text-green-700 font-bold text-base md:text-lg">Rs. {month.revenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="text-red-600 font-semibold text-sm md:text-base">Expenses:</span>
                        <span className="text-red-700 font-bold text-base md:text-lg">Rs. {month.expenses.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 md:h-3">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-green-600 h-2.5 md:h-3 rounded-full transition-all duration-500" 
                          style={{ 
                            width: `${Math.max(month.revenue, month.expenses) > 0 ? (month.revenue / Math.max(month.revenue, month.expenses)) * 100 : 0}%` 
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="font-semibold text-gray-700 text-sm md:text-base">Net:</span>
                        <span className={`font-bold text-lg md:text-xl ${(month.revenue - month.expenses) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          Rs. {(month.revenue - month.expenses).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Monthly Details Modal inside Trend tab */}
              {selectedMonthDetails && (
                <Card className="border-none shadow-2xl rounded-3xl overflow-hidden mt-6">
                  <CardHeader className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                    <CardTitle className="text-2xl font-bold flex items-center justify-between">
                      <span>Details for {selectedMonthDetails} {selectedYear}</span>
                      <Button 
                        onClick={() => setSelectedMonthDetails(null)}
                        variant="outline"
                        className="text-white border-white hover:bg-white hover:text-cyan-500"
                      >
                        Close
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="max-h-96 overflow-y-auto space-y-4">
                      {monthlyDetails.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                          <p className="text-xl">No transactions found for this month</p>
                        </div>
                      ) : (
                        monthlyDetails.map((detail, index) => (
                          <div 
                            key={`detail-${detail.type}-${detail.date}-${detail.description}-${index}`} 
                            className={`flex items-center justify-between p-4 rounded-xl border-l-4 ${
                              detail.type === 'revenue' 
                                ? 'bg-green-50 border-green-500' 
                                : 'bg-red-50 border-red-500'
                            }`}
                          >
                            <div>
                              <p className="font-semibold text-lg">{detail.description}</p>
                              <p className="text-gray-600">{detail.date}</p>
                            </div>
                            <span className={`font-bold text-xl ${
                              detail.type === 'revenue' ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {detail.type === 'revenue' ? '+' : '-'}Rs. {detail.amount.toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
          </CardContent>
          </Card>
        </TabsContent>

        {/* Expense Management */}
        <TabsContent value="expenses">
          <div className="p-4 md:p-6">
              {/* Month/Year selectors removed (using global filters above) */}
              <div className="flex gap-3 flex-wrap mb-6">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      id="reports-expenses-trigger"
                      className="h-12 px-6 bg-blue-500 hover:bg-blue-400 text-white rounded-xl shadow-lg text-lg font-semibold"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Expense</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="description-exp">Description</Label>
                        <Input
                          id="description-exp"
                          value={expenseForm.description}
                          onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter expense description"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="amount-exp">Amount (Rs.)</Label>
                        <Input
                          id="amount-exp"
                          type="number"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category-exp">Category</Label>
                        <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category: value }))}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {expenseCategories.map((category) => (
                              <SelectItem key={`exp-cat-${category}`} value={category}>{category}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="date-exp">Date</Label>
                        <Input
                          id="date-exp"
                          type="date"
                          value={expenseForm.date}
                          onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={() => addExpense()}
                        disabled={!expenseForm.description || !expenseForm.amount}
                        className="bg-blue-500 hover:bg-blue-400"
                      >
                        Add Expense
                      </Button>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button 
                  onClick={exportExpensesToCSV}
                  className="h-12 px-6 bg-blue-500 hover:bg-blue-400 text-white rounded-xl shadow-lg text-lg font-semibold"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                {/* Export Report button removed */}
              </div>

              {/* KPIs for selected month in Expenses tab */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-2xl p-4">
                  <div className="text-sm text-blue-700 font-semibold mb-1">Total Expenses</div>
                  <div className="text-2xl font-bold text-blue-900">Rs. {totalMonthExpenses.toLocaleString()}</div>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-sm text-slate-700 font-semibold mb-1">Entries</div>
                  <div className="text-2xl font-bold text-slate-800">{filteredExpensesForMonth.length}</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-2xl p-4">
                  <div className="text-sm text-blue-700 font-semibold mb-1">Avg per Expense</div>
                  <div className="text-2xl font-bold text-blue-900">Rs. {avgPerExpense.toLocaleString()}</div>
                </div>
              </div>

              {/* Removed highlight card: Revenue vs Expenses with Net Income */}
              {/* Category and Daily charts for current month (Expenses tab) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Category Pie */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <div className="font-semibold text-gray-700 mb-2">By Category</div>
                  {categoryData.length === 0 ? (
                    <div className="text-sm text-gray-500">No data</div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={90} label>
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-expenses-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                {/* Daily Bar */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 xl:col-span-2">
                  <div className="font-semibold text-gray-700 mb-2">Daily Spend</div>
                  {dailyData.length === 0 ? (
                    <div className="text-sm text-gray-500">No data</div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="amount" fill="#3b82f6" radius={[8,8,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Inline Add Expense form removed; now handled via modal dialog */}

              {expTotal === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-xl">No expenses recorded for this month</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const totalPages = Math.max(1, Math.ceil(expTotal / EXP_PAGE_SIZE));
                    const currentPage = Math.min(expPage, totalPages);
                    const start = (currentPage - 1) * EXP_PAGE_SIZE;
                    const end = Math.min(start + EXP_PAGE_SIZE, expTotal);
                    const pageItems = pageExpenses;
                    return (
                      <>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>
                            Showing {expTotal === 0 ? 0 : start + 1}-{end} of {expTotal}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              disabled={currentPage === 1}
                              onClick={() => setExpPage(p => Math.max(1, p - 1))}
                              className="h-8 px-3"
                            >
                              Prev
                            </Button>
                            <span className="px-2">Page {currentPage} / {totalPages}</span>
                            <Button
                              variant="outline"
                              disabled={currentPage === totalPages}
                              onClick={() => setExpPage(p => Math.min(totalPages, p + 1))}
                              className="h-8 px-3"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {pageItems.map((expense: any, idx: number) => (
                      <div key={`exp-${expense._id || expense.id || expense.date || idx}`} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div>
                          <h4 className="font-semibold text-blue-900">{expense.description}</h4>
                          <p className="text-sm text-blue-700">
                            {expense.category} • {new Date(expense.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-blue-900 text-lg">Rs. {expense.amount.toLocaleString()}</span>
                          <Button
                            size="sm"
                            onClick={() => deleteExpense(expense.id)}
                            className="bg-red-500 hover:bg-red-600 text-white p-2"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>
                            Showing {expTotal === 0 ? 0 : start + 1}-{end} of {expTotal}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              disabled={currentPage === 1}
                              onClick={() => setExpPage(p => Math.max(1, p - 1))}
                              className="h-8 px-3"
                            >
                              Prev
                            </Button>
                            <span className="px-2">Page {currentPage} / {totalPages}</span>
                            <Button
                              variant="outline"
                              disabled={currentPage === totalPages}
                              onClick={() => setExpPage(p => Math.min(totalPages, p + 1))}
                              className="h-8 px-3"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
          </div>
        </TabsContent>

        
      </Tabs>
    </div>
  );
};

export default Reports;
