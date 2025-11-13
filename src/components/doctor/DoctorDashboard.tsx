import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, User, Stethoscope, DollarSign, TrendingUp } from 'lucide-react';
import { useDoctorDashboard } from '@/hooks/useApi';

const DoctorDashboard: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useDoctorDashboard();

  // Refetch when a new token is generated for real-time updates
  useEffect(() => {
    const handler = () => {
      qc.invalidateQueries({ queryKey: ['doctorDashboard'] });
    };
    window.addEventListener('tokenGenerated', handler);
    return () => window.removeEventListener('tokenGenerated', handler);
  }, [qc]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Today's Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? '...' : error ? 'Error' : data?.todayAppointments}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Scheduled for today
          </p>
        </CardContent>
      </Card>

      {/* Patients Seen */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Patients Seen</CardTitle>
          <User className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? '...' : error ? 'Error' : data?.patientsSeen}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Unique patients today
          </p>
        </CardContent>
      </Card>

      {/* Tokens Generated */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Tokens Generated</CardTitle>
          <Stethoscope className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? '...' : error ? 'Error' : data?.todayTokens}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Patient tokens today
          </p>
        </CardContent>
      </Card>

      {/* Today's Revenue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? '...' : error ? 'Error' : data?.revenue?.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total revenue generated
          </p>
        </CardContent>
      </Card>

      {/* Commission */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Commission</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? '...' : error ? 'Error' : data?.commission?.toLocaleString('en-PK', { style: 'currency', currency: 'PKR' })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.commissionRate}% of revenue
          </p>
        </CardContent>
      </Card>

      {/* Next Appointment */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Next Appointment</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? '...' : error ? 'Error' : '12:30 PM'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            With Ali Raza
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorDashboard;
