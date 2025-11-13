import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const DoctorRevenue: React.FC = () => {
  const { user } = useAuth();
  const doctorId = user?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['doctor-revenue', doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/doctor/dashboard?doctorId=${doctorId}`);
      if (!res.ok) throw new Error('Failed to load revenue data');
      return res.json();
    },
    enabled: !!doctorId,
  });

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-xl font-semibold mb-4">Revenue & Commission</h3>
      
      {isLoading ? (
        <p>Loading revenue data...</p>
      ) : error ? (
        <p className="text-red-500">Error loading revenue data</p>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 className="text-sm font-medium text-blue-800 mb-1">Today's Revenue</h4>
            <p className="text-2xl font-bold text-blue-600">
              {data.revenue?.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' })}
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg border border-green-100">
            <h4 className="text-sm font-medium text-green-800 mb-1">Commission</h4>
            <p className="text-2xl font-bold text-green-600">
              {data.commission?.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' })}
            </p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <h4 className="text-sm font-medium text-purple-800 mb-1">Commission Rate</h4>
            <p className="text-2xl font-bold text-purple-600">
              {((data.commissionRate || 0) * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      ) : (
        <p>No revenue data available</p>
      )}
    </div>
  );
};

export default DoctorRevenue;
