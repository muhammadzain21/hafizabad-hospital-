import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

const DoctorAppointments: React.FC = () => {
  const { user } = useAuth();
  const doctorId = user?.id;
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { 
    data = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<any[]>({
    queryKey: ['doctor-appointments', doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/doctor/appointments/today?doctorId=${doctorId}`);
      if (!res.ok) throw new Error('Failed to load appointments');
      return res.json();
    },
    enabled: !!doctorId,
  });

  const filteredAppointments = data
    .filter(appt => statusFilter === 'all' || appt.status === statusFilter)
    .filter(appt => 
      searchTerm === '' || 
      appt.patientId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appt.patientId?.phone?.includes(searchTerm)
    );

  const updateAppointmentStatus = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update appointment');
      refetch();
    } catch (err) {
      console.error('Error updating appointment:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Today's Appointments</h3>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | 'all')}
            className="border rounded-md px-2 py-1 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            type="text"
            placeholder="Search patients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded-md px-2 py-1 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <p>Loading appointments...</p>
      ) : error ? (
        <p className="text-red-500">Error loading appointments</p>
      ) : filteredAppointments.length === 0 ? (
        <p>No appointments found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAppointments.map((appt) => (
                <tr key={appt._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(appt.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{appt.patientId?.name}</div>
                    <div className="text-sm text-gray-500">{appt.patientId?.age} / {appt.patientId?.gender}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{appt.patientId?.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                      appt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      appt.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                      appt.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {appt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {appt.status === 'pending' && (
                      <button 
                        onClick={() => updateAppointmentStatus(appt._id, 'confirmed')}
                        className="text-blue-600 hover:text-blue-900 mr-2"
                      >
                        Confirm
                      </button>
                    )}
                    {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                      <button 
                        onClick={() => updateAppointmentStatus(appt._id, 'completed')}
                        className="text-green-600 hover:text-green-900 mr-2"
                      >
                        Complete
                      </button>
                    )}
                    {appt.status !== 'cancelled' && (
                      <button 
                        onClick={() => updateAppointmentStatus(appt._id, 'cancelled')}
                        className="text-red-600 hover:text-red-900"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DoctorAppointments;
