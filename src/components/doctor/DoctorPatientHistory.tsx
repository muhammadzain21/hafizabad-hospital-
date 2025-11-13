import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Activity, 
  Clipboard, 
  Phone, 
  MapPin,
  Clock,
  DollarSign,
  Stethoscope,
  Printer
} from 'lucide-react';

type Visit = {
  dateTime: string;
  doctor: string;
  department: string;
  fee: string;
  symptoms: string;
  diagnosis: string;
  prescription: string;
};

type Patient = {
  name: string;
  mrNumber: string;
  phone: string;
  age: string;
  gender: string;
  address: string;
  visits: Visit[];
};

interface DoctorPatientHistoryProps {
  patient?: Patient;
  hideBackButton?: boolean;
}

const DoctorPatientHistory: React.FC<DoctorPatientHistoryProps> = ({ patient: propPatient, hideBackButton }) => {
  const { user } = useAuth();
  const doctorId = user?.id;
  const location = useLocation();
  const navigate = useNavigate();
  const patient: Patient | undefined = propPatient || location.state?.patient;

  const { data: patientData, isLoading } = useQuery<Patient>({
    queryKey: ['doctor-patient-history', doctorId, patient?.mrNumber],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/doctor/patients/${patient?.mrNumber}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load patient history');
      return res.json();
    },
    enabled: !!doctorId && !!patient?.mrNumber,
    initialData: patient
  });

  // Build visits fallback if server didn't include them
  const safeVisits: Visit[] = React.useMemo(() => {
    const v = (patientData as any)?.visits;
    if (Array.isArray(v) && v.length) return v;
    // Fallback to local tokens if available
    const tokens = JSON.parse(localStorage.getItem('tokens') || '[]');
    const relevant = tokens
      .filter((t: any) => (patient?.mrNumber && t.mrNumber === patient?.mrNumber) || (patient?.phone && t.phone === patient?.phone))
      .map((t: any) => ({
        dateTime: t.dateTime,
        doctor: t.doctor,
        department: t.department,
        fee: t.finalFee?.toString?.() || t.fee?.toString?.() || '0',
        symptoms: t.symptoms || '',
        diagnosis: t.diagnosis || '',
        prescription: t.prescription || ''
      }))
      .sort((a: any, b: any) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    return relevant;
  }, [patientData, patient?.mrNumber, patient?.phone]);

  if (!patientData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Patient Not Found</h1>
          <p className="text-muted-foreground">
            Please select a patient from the appointments list
          </p>
          <Button 
            onClick={() => navigate(-1)}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Appointments
          </Button>
        </div>
      </div>
    );
  }

  const firstVisit = safeVisits.length ? safeVisits[safeVisits.length - 1] : undefined;
  const lastVisit = safeVisits.length ? safeVisits[0] : undefined;

  const patientId = (patientData as any)?._id || (patient as any)?.id || (patient as any)?._id;

  const { data: prescriptions = [] } = useQuery<any[]>({
    queryKey: ['doctor-patient-prescriptions', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/doctor/prescriptions?patientId=${patientId}`, {
        headers: { 'Authorization': `Bearer ${token || ''}` },
      });
      if (!res.ok) throw new Error('Failed to load prescriptions');
      return res.json();
    },
    enabled: !!patientId,
    refetchInterval: 10000,
  });

  return (
    <div className="container mx-auto py-8">
      {!hideBackButton && (
        <Button 
          onClick={() => navigate(-1)}
          variant="outline"
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Appointments
        </Button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="text-lg font-medium">{patientData.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">MR Number</p>
              <p className="text-lg font-medium">{patientData.mrNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Age / Gender</p>
              <p className="text-lg font-medium">{patientData.age} / {patientData.gender}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="text-lg font-medium">{patientData.phone}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="text-lg font-medium">{patientData.address}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Medical Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-3">
              <div className="bg-blue-100 p-3 rounded-full">
                <Calendar className="h-6 w-6 text-blue-800" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">First Visit</p>
                <p className="text-xl font-bold">{firstVisit ? new Date(firstVisit.dateTime).toLocaleDateString() : '—'}</p>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg flex items-center gap-3">
              <div className="bg-green-100 p-3 rounded-full">
                <Clock className="h-6 w-6 text-green-800" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Visit</p>
                <p className="text-xl font-bold">{lastVisit ? new Date(lastVisit.dateTime).toLocaleDateString() : '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clipboard className="h-5 w-5" />
            Visit History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {safeVisits.map((visit, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {new Date(visit.dateTime).toLocaleDateString()} at {new Date(visit.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {visit.department} • {visit.doctor}
                  </p>
                </div>
                <div className="text-lg font-bold">
                  {parseInt(visit.fee).toLocaleString('en-PK', { style: 'currency', currency: 'PKR' })}
                </div>
              </div>

              {visit.symptoms && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Symptoms</h4>
                  <p>{visit.symptoms}</p>
                </div>
              )}

              {visit.diagnosis && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Diagnosis</h4>
                  <p>{visit.diagnosis}</p>
                </div>
              )}

              {visit.prescription && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Prescription</h4>
                  <p>{visit.prescription}</p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clipboard className="h-5 w-5" />
            Prescription History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.isArray(prescriptions) && prescriptions.length > 0 ? (
            prescriptions.map((p:any) => (
              <div key={p.id || p._id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{new Date(p.createdAt).toLocaleString()}</div>
                  {p.status && <span className="text-sm text-muted-foreground">{p.status}</span>}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Items: {(p.items || []).map((it:any) => it.medicineName || it.medicine).filter(Boolean).join(', ')}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-4">No prescriptions found for this patient</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DoctorPatientHistory;
