import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const DoctorTokens: React.FC = () => {
  const { user } = useAuth();
  const doctorId = user?.id;

  const { 
    data = [], 
    isLoading, 
    error 
  } = useQuery<any[]>({
    queryKey: ['doctor-tokens', doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/doctor/tokens/today?doctorId=${doctorId}`);
      if (!res.ok) throw new Error('Failed to load tokens');
      return res.json();
    },
    enabled: !!doctorId,
  });

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h3 className="text-xl font-semibold mb-4">Today's Tokens</h3>
      
      {isLoading ? (
        <p>Loading tokens...</p>
      ) : error ? (
        <p className="text-red-500">Error loading tokens</p>
      ) : data.length === 0 ? (
        <p>No tokens assigned to you today</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age/Gender</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((token) => (
                <tr key={token._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{token.tokenNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{token.patientId?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{token.patientId?.age} / {token.patientId?.gender}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(token.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{token.status || 'pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DoctorTokens;
