import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface CommissionSummary {
  totalCommission: number;
  totalProcedures: number;
  avgCommission: number;
  highestCommission: number;
}

interface CommissionDetail {
  _id: string;
  date: string;
  patientName: string;
  service: string;
  bill: number;
  commissionRate: number;
  commissionEarned: number;
}

const statClasses =
  'flex flex-col justify-center items-center bg-indigo-50 rounded-lg px-6 py-4 text-center';

const DoctorCommission: React.FC = () => {
  const { user } = useAuth();
  const doctorId = user?.id;

  const today = new Date();
  const last30 = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const [start, setStart] = useState(last30.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useQuery<{ summary: CommissionSummary; details: CommissionDetail[] }>({
    queryKey: ['doctor-commission', doctorId, start, end],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/doctor/commission?start=${start}&end=${end}` , {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        }
      });
      if (!res.ok) throw new Error('Failed to load commission');
      return res.json();
    },
    enabled: !!doctorId,
  });

  const summary = data?.summary;
  const details = data?.details || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-indigo-800">Your Commission</h2>
          <p className="text-gray-600">View a detailed breakdown of your earnings.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="text-gray-500">-</span>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Commission Summary</CardTitle>
          <p className="text-sm text-gray-600">Key metrics for the selected period.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={statClasses}>
            <span className="text-xs text-gray-600 mb-1">Total Commission</span>
            <span className="text-xl font-semibold">
              {summary ? summary.totalCommission.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' }) : '–'}
            </span>
          </div>
          <div className={statClasses}>
            <span className="text-xs text-gray-600 mb-1">Total Procedures</span>
            <span className="text-2xl font-semibold">{summary ? summary.totalProcedures : '–'}</span>
          </div>
          <div className={statClasses}>
            <span className="text-xs text-gray-600 mb-1">Avg. Commission/Procedure</span>
            <span className="text-xl font-semibold">
              {summary ? summary.avgCommission.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' }) : '–'}
            </span>
          </div>
          <div className={statClasses}>
            <span className="text-xs text-gray-600 mb-1">Highest Commission</span>
            <span className="text-xl font-semibold">
              {summary ? summary.highestCommission.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' }) : '–'}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission Details</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-4 py-2 font-medium">Service / Procedure</th>
                <th className="px-4 py-2 font-medium">Total Bill (PKR)</th>
                <th className="px-4 py-2 font-medium">Commission Rate</th>
                <th className="px-4 py-2 font-medium">Commission Earned (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : details.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    No data available for the selected period.
                  </td>
                </tr>
              ) : (
                details.map((v) => (
                  <tr key={v._id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 whitespace-nowrap">{v.date.slice(0, 10)}</td>
                    <td className="px-4 py-3">{v.patientName}</td>
                    <td className="px-4 py-3">{v.service}</td>
                    <td className="px-4 py-3">{v.bill.toLocaleString()}</td>
                    <td className="px-4 py-3">{v.commissionRate}%</td>
                    <td className="px-4 py-3 font-medium text-indigo-700">
                      {v.commissionEarned.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
};

export default DoctorCommission;
