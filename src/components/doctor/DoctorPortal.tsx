import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import DoctorPrescription from './DoctorPrescription';
import DoctorHeader from './DoctorHeader';
import DoctorCommission from './DoctorCommission';
import DoctorPatientHistory from './DoctorPatientHistory';
import PrescriptionHistory from './PrescriptionHistory';
import PatientSearch from '../PatientSearch';
import DoctorNotifications from './DoctorNotifications';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Activity, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { toast } from '@/components/ui/use-toast';

const metricCardClasses =
  'flex flex-col justify-center items-start bg-white border border-gray-200 rounded-xl p-5 shadow-sm';


interface Consultation {
  id: string;
  patient: {
    _id: string;
    name: string;
    mrNumber?: string;
  };
  dateTime: string;
  fee: number;
  tokenNumber: number;
}

const statusColors: Record<string, string> = {
  waiting: 'bg-yellow-100 text-yellow-800',
  "in consultation": 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

const DoctorPortal: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const doctorId = (user as any)?.doctorId || user?.id;

  // Socket.IO connection for real-time notifications
  useEffect(() => {
    if (!doctorId) return;
    const base = API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const socket: Socket = io(base, {
      withCredentials: true,
      // Prefer polling first to avoid ws handshake issues in some Windows/Electron installs,
      // then upgrade to websocket if possible
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    });
    socket.on('connect', () => {
      socket.emit('doctor:register', doctorId);
    });
    socket.on('connect_error', (err) => {
      // Non-blocking notice in console; UI continues to function
      console.warn('[socket] connect_error', err?.message || err);
    });

    const handleScheduled = (payload: any) => {
      toast({
        title: 'New IPD Visit Scheduled',
        description: `${new Date(payload?.dateTime).toLocaleString()}${payload?.patient?._id ? '' : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    };
    const handleUpdated = (payload: any) => {
      toast({ title: 'IPD Visit Updated', description: new Date(payload?.dateTime).toLocaleString() });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    };
    const handleDeleted = () => {
      toast({ title: 'IPD Visit Cancelled' });
      queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    };

    socket.on('ipd:visit-scheduled', handleScheduled);
    socket.on('ipd:visit-updated', handleUpdated);
    socket.on('ipd:visit-deleted', handleDeleted);

    return () => {
      socket.off('ipd:visit-scheduled', handleScheduled);
      socket.off('ipd:visit-updated', handleUpdated);
      socket.off('ipd:visit-deleted', handleDeleted);
      socket.disconnect();
    };
  }, [doctorId, queryClient]);

  const { data: dashboard } = useQuery({
    queryKey: ['doctor-dashboard', doctorId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/doctor/dashboard', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      return res.json();
    },
    enabled: !!doctorId,
    initialData: {},
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // Pending queue across dates
  // Pending queue for TODAY only (aligns with dashboard metrics)
  const { data: queue = [] } = useQuery<any[]>({
    queryKey: ['doctor-queue', doctorId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/doctor/tokens/today${doctorId ? `?doctorId=${encodeURIComponent(doctorId)}` : ''}` , {
        headers: { 'Authorization': `Bearer ${token || ''}` },
      });
      if (!res.ok) throw new Error('Failed to fetch today tokens');
      const tokens = await res.json();
      // Normalize to the previous queue shape and show only non-completed
      return (tokens || [])
        .filter((t: any) => (t.status || 'waiting') !== 'completed')
        .map((t: any) => ({
          id: t._id,
          tokenNumber: t.tokenNumber,
          status: t.status || 'waiting',
          dateTime: t.dateTime,
          patient: t.patientId,
        }));
    },
    enabled: !!doctorId,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const [activeTab, setActiveTab] = useState<'prescription' | 'history' | 'search' | 'commission' | 'prescriptionsHistory' | 'notifications'>('prescription');
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [editPrescription, setEditPrescription] = useState<any | null>(null);

  const handleLogout = () => {
    // reuse header behavior from DoctorHeader
    logout();
    navigate('/login');
  };

  const { data: patients = [], refetch: refetchPatients } = useQuery<any[]>({
    queryKey: ['doctor-patients', doctorId, search],
    queryFn: async () => {
      const query = search ? `?q=${encodeURIComponent(search)}` : '';
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/doctor/patients${query}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch patients');
      return res.json();
    },
    enabled: !!doctorId,
  });

  const { data: consultations = [] } = useQuery<Consultation[]>({
    queryKey: ['doctor-consultations-history', doctorId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/doctor/consultations/history', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch consultation history');
      return res.json();
    },
    enabled: activeTab === 'history' && !!doctorId,
  });

  // Prescriptions list (optionally by selected patient)
  const { data: prescriptions = [], refetch: refetchPrescriptions } = useQuery<any[]>({
    queryKey: ['doctor-prescriptions-list', doctorId, selectedPatient?._id],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const q = selectedPatient?._id ? `?patientId=${selectedPatient._id}` : '';
      const res = await fetch(`/api/doctor/prescriptions${q}`, {
        headers: { 'Authorization': `Bearer ${token || ''}` },
      });
      if (!res.ok) throw new Error('Failed to fetch prescriptions');
      return res.json();
    },
    enabled: activeTab === 'history' && !!doctorId,
    refetchInterval: 8000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/doctor/prescriptions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token || ''}` },
      });
      if (!res.ok) throw new Error('Failed to delete prescription');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-prescriptions-list'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-consultations-history'] });
    }
  });

  return (
    <>
    <div className="flex flex-col min-h-screen">
      <DoctorHeader />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-56 shrink-0 bg-white border border-gray-200 rounded-xl p-4 h-fit sticky top-24 self-start">
            <div className="flex flex-col gap-2">
              <Button
                variant={activeTab === 'prescription' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setActiveTab('prescription')}
              >
                Prescription
              </Button>
              <Button
                variant={activeTab === 'history' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setActiveTab('history')}
              >
                Consultation History
              </Button>
              <Button
                variant={activeTab === 'search' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setActiveTab('search')}
              >
                Patient Search
              </Button>
              <Button
                variant={activeTab === 'notifications' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setActiveTab('notifications')}
              >
                Notifications
              </Button>
              <Button
                variant={activeTab === 'commission' ? 'default' : 'ghost'}
                className="justify-start"
                onClick={() => setActiveTab('commission')}
              >
                Commission
              </Button>
              <Button
                variant={activeTab === 'prescriptionsHistory' ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => setActiveTab('prescriptionsHistory')}
              >
                Prescription History
              </Button>
              <div className="h-px bg-gray-200 my-2" />
              <Button variant="destructive" className="justify-start" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </aside>

          {/* Content Area */}
          <div className="flex-1 space-y-6">
            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card className={`${metricCardClasses} bg-blue-50 border-blue-200`}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-900">
              <Users className="w-4 h-4" /> Today's Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{typeof dashboard?.patientsSeen === 'number' ? dashboard.patientsSeen : 0}</span>
          </CardContent>
        </Card>

        <Card className={`${metricCardClasses} bg-amber-50 border-amber-200`}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-900">
              <Activity className="w-4 h-4" /> Pending Consultations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{Array.isArray(queue) ? queue.length : (dashboard?.todayAppointments ?? '–')}</span>
          </CardContent>
        </Card>

        <Card className={`${metricCardClasses} bg-emerald-50 border-emerald-200`}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-emerald-900">
              <DollarSign className="w-4 h-4" /> Today's Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {(
                typeof dashboard?.revenue === 'number'
                  ? dashboard.revenue
                  : 0
              ).toLocaleString('en-PK', { style: 'currency', currency: 'PKR' })}
            </span>
          </CardContent>
        </Card>

        <Card className={`${metricCardClasses} bg-violet-50 border-violet-200`}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-violet-900">
              <FileText className="w-4 h-4" /> Monthly Commission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {(
                typeof dashboard?.commission === 'number'
                  ? dashboard.commission
                  : 0
              ).toLocaleString('en-PK', { style: 'currency', currency: 'PKR' })}
            </span>
          </CardContent>
        </Card>

        {/* New: Total Patients */}
        <Card className={`${metricCardClasses} bg-sky-50 border-sky-200`}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-sky-900">
              <Users className="w-4 h-4" /> Total Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">{typeof dashboard?.totalPatients === 'number' ? dashboard.totalPatients : 0}</span>
          </CardContent>
        </Card>

        {/* New: Total Revenue */}
        <Card className={`${metricCardClasses} bg-teal-50 border-teal-200`}>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-teal-900">
              <DollarSign className="w-4 h-4" /> Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold">
              {(
                typeof dashboard?.totalRevenue === 'number'
                  ? dashboard.totalRevenue
                  : 0
              ).toLocaleString('en-PK', { style: 'currency', currency: 'PKR' })}
            </span>
          </CardContent>
        </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Patients - only show on Prescription tab */}
        {activeTab === 'prescription' && (
        <Card className="lg:col-span-1">
          <CardHeader className="space-y-2">
            <CardTitle>Assigned Patients</CardTitle>
            <Input
              placeholder="Search patients by name / MR #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">Patients currently in your queue.</p>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-2 font-medium">Patient</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(search ? patients : queue).map((item: any) => {
                  const patientRow = search ? item : item.patient;
                  const status = search ? '' : (item.status || 'waiting');
                  return (
                    <tr
                      key={patientRow._id}
                      className="border-b last:border-b-0 cursor-pointer hover:bg-indigo-50"
                      onClick={() => {
                        setSelectedPatient(patientRow);
                        setSelectedTokenId(search ? null : item.id);
                        setActiveTab('history');
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{patientRow.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {patientRow.mrNumber || patientRow._id}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {status && (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                              statusColors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(search ? patients.length === 0 : queue.length === 0) && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                      No patients in queue
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
        )}

        {/* Right Panel */}
        <div className={activeTab === 'prescription' ? "lg:col-span-2" : "lg:col-span-3"}>
          {activeTab === 'history' ? (
            selectedPatient ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Patient History</h2>
                  <Button variant="outline" onClick={() => setSelectedPatient(null)}>
                    Close
                  </Button>
                </div>
                <DoctorPatientHistory patient={selectedPatient} hideBackButton />
              </>
            ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Previous Consultations</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">Date & Time</th>
                      <th className="px-6 py-3 text-left">Patient</th>
                      <th className="px-6 py-3 text-left">Token</th>
                      <th className="px-6 py-3 text-left">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {consultations.map((consult) => (
                      <tr 
                        key={consult.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedPatient(consult.patient)}
                      >
                        <td className="px-6 py-4">
                          {new Date(consult.dateTime).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {consult.patient.name} ({consult.patient.mrNumber})
                        </td>
                        <td className="px-6 py-4">{consult.tokenNumber}</td>
                        <td className="px-6 py-4">Rs. {consult.fee}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="text-xl font-bold mt-8">Prescriptions</h2>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">Created</th>
                      <th className="px-6 py-3 text-left">Patient</th>
                      <th className="px-6 py-3 text-left">Items</th>
                      <th className="px-6 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {prescriptions.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">{new Date(p.createdAt).toLocaleString()}</td>
                        <td className="px-6 py-4">{p.patient?.name} {p.patient?.mrNumber && `(${p.patient.mrNumber})`}</td>
                        <td className="px-6 py-4">{(p.items || []).map((it: any) => it.medicineName || it.medicine).filter(Boolean).join(', ')}</td>
                        <td className="px-6 py-4 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setEditPrescription(p); setActiveTab('prescription'); }}>
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(p.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>)
                    )}
                    {prescriptions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No prescriptions found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )
          ) : activeTab === 'prescription' ? (
            <DoctorPrescription defaultPatientId={selectedPatient?._id} tokenId={selectedTokenId || undefined} editPrescription={editPrescription || undefined} />
          ) : activeTab === 'search' ? (
            <PatientSearch 
              onOpenPatientHistory={(p:any) => {
                setSelectedPatient(p);
                setActiveTab('history');
              }}
              onOpenPrescriptionHistory={(p:any) => {
                setSelectedPatient(p);
                setActiveTab('prescriptionsHistory');
              }}
            />
          ) : activeTab === 'commission' ? (
            <DoctorCommission />
          ) : activeTab === 'prescriptionsHistory' ? (
            <PrescriptionHistory prefill={{
              mrNumber: selectedPatient?.mrNumber,
              phone: (selectedPatient as any)?.phone,
              name: selectedPatient?.name,
            }} />
          ) : activeTab === 'notifications' ? (
            <DoctorNotifications />
          ) : null}
          </div>
            </div>
          </div>
        </div>
      </main>
    </div>
    </>
  );
};

export default DoctorPortal;
