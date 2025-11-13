import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  Trash2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { admitPatient, IpdAdmissionCreatePayload } from '@/hooks/useIpdApi';
import { toast } from 'sonner';
import AdmissionDialog from '@/components/ipd/AdmissionDialog';

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

const PatientHistory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const patient: Patient | undefined = location.state?.patient;
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isDoctor = user?.role === 'doctor';

  const [visits, setVisits] = React.useState<Visit[]>(patient?.visits || []);

  // Try to fetch richer patient data by MR number (server authoritative)
  // If user is a doctor, use doctor route that also returns OPD visits derived from tokens/prescriptions
  // For non-doctors, use public patients history endpoint that also returns visits
  const { data: serverPatient } = useQuery<Patient | undefined>({
    queryKey: ['patient-history', patient?.mrNumber, isDoctor],
    queryFn: async () => {
      if (!patient?.mrNumber) return undefined;
      const token = localStorage.getItem('token');
      const mr = encodeURIComponent(patient.mrNumber);
      const url = isDoctor
        ? `/api/doctor/patients/${mr}`
        : `/api/patients/history/mr/${mr}`; // public route returns patient + visits
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token || ''}` } });
      if (!res.ok) {
        // Graceful fallback when forbidden or not found
        if (res.status === 403 || res.status === 404) return undefined;
        throw new Error('Failed to load patient history');
      }
      const data = await res.json();
      // doctor route returns object; general route returns object as well
      // Keep uniform shape
      return data || undefined;
    },
    enabled: !!patient?.mrNumber,
  });

  const patientId = (serverPatient as any)?._id || (patient as any)?._id || (serverPatient as any)?.id || (patient as any)?.id;

  // Fetch IPD admissions (light) and derive admit/discharge records for this MR number
  const { data: ipdRecords = [] } = useQuery<any[]>({
    queryKey: ['patient-ipd-records', patient?.mrNumber],
    queryFn: async () => {
      if (!patient?.mrNumber) return [];
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`/api/ipd/admissions?light=1`, {
          headers: { 'Authorization': `Bearer ${token || ''}` },
        });
        if (!res.ok) throw new Error('Failed to load IPD admissions');
        const all = await res.json();
        const list = Array.isArray(all) ? all : (all?.items || []);
        const norm = (s: any) => String(s || '').replace(/[^a-z0-9]/gi,'').toLowerCase();
        const mrNeedle = norm(patient.mrNumber);
        const nameNeedle = norm((patient as any).name);
        const phoneNeedle = norm((patient as any).phone);

        const filtered = list.filter((a: any) => {
          const pid = typeof a.patientId === 'string' ? a.patientId : a.patientId?._id;
          if (patientId && pid && String(pid) === String(patientId)) return true;

          const mrHay = norm(a?.patientId?.mrNumber || a?.patient?.mrNumber);
          if (mrNeedle && mrHay && mrHay.includes(mrNeedle)) return true;

          const nameHay = norm(a?.patientId?.name || a?.patient?.name);
          if (nameNeedle && nameHay && nameHay === nameNeedle) return true;

          const phoneHay = norm(a?.patientId?.phone || a?.patient?.phone);
          if (phoneNeedle && phoneHay && phoneHay === phoneNeedle) return true;

          return false;
        });
        // For richer timeline, fetch full details for each admission
        const tokenHdr = { 'Authorization': `Bearer ${token || ''}` } as Record<string,string>;
        const details = await Promise.all(filtered.map(async (a: any) => {
          try {
            const r = await fetch(`/api/ipd/admissions/${a._id}` , { headers: tokenHdr });
            if (!r.ok) throw new Error('detail fetch failed');
            return await r.json();
          } catch { return a; }
        }));

        const events: any[] = [];
        for (const a of details) {
          if (a.admitDateTime) events.push({
            date: a.admitDateTime,
            type: 'Admitted',
            summary: [
              a.admittingDiagnosis ? `Diagnosis: ${a.admittingDiagnosis}` : null,
              a.wardId ? `Ward: ${a.wardId?.name || a.wardId}` : null,
              a.bedId ? `Bed: ${a.bedId?.name || a.bedId}` : null,
            ].filter(Boolean).join(' • ')
          });
          // Doctor visits
          (a.doctorVisits || []).forEach((v: any) => {
            events.push({ date: v.dateTime, type: 'Doctor Visit', summary: [v.doctorName && `Dr. ${v.doctorName}`, v.diagnosis, v.treatment].filter(Boolean).join(' • ') });
          });
          // Vitals snapshots
          (a.vitals || []).forEach((vt: any) => {
            events.push({ date: vt.dateTime, type: 'Vitals', summary: [`BP ${vt.bp}`, `HR ${vt.heartRate}`, `Temp ${vt.temperature}`].filter(Boolean).join(' • ') });
          });
          // Billing items
          (a.billing || []).forEach((bi: any) => {
            events.push({ date: bi.date, type: 'Billing', summary: `${bi.description} — Rs. ${bi.amount}` });
          });
          if (a.dischargeDateTime) {
            const sum = a.dischargeSummary;
            const text = sum ? (sum.remarks || sum.followUpInstructions || '') : '';
            events.push({ date: a.dischargeDateTime, type: 'Discharged', summary: text });
          }
        }
        if (!events.length) {
          console.log('[PatientHistory] No IPD events matched for', { mr: patient.mrNumber, patientId, total: list.length });
        }
        return events;
      } catch (e) {
        console.warn('IPD admissions fetch failed; skipping IPD in timeline', e);
        return [];
      }
    },
    enabled: !!patient?.mrNumber,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  React.useEffect(() => {
    if (serverPatient?.visits?.length) {
      // Prefer server visits when available
      setVisits(serverPatient.visits.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()));
      return;
    }
    // Fallback: build from local tokens
    if (!patient?.visits?.length) {
      const allTokens = JSON.parse(localStorage.getItem('tokens') || '[]');
      const relevant = allTokens.filter((t: any) => (t.mrNumber && patient?.mrNumber && t.mrNumber === patient.mrNumber) || (t.phone && patient?.phone && t.phone === patient.phone));
      const built = buildVisitsFromTokens(relevant);
      setVisits(built);
    }
  }, [serverPatient, patient?.mrNumber, patient?.phone]);

  // build combined timeline entries (OPD visits + IPD admit/discharge)
  const combinedTimeline = React.useMemo(() => {
    const items: { date: string; kind: 'visit'|'ipd'; title: string; detail?: string }[] = [];
    for (const v of visits) {
      items.push({ date: v.dateTime, kind: 'visit', title: `OPD visit — ${v.department || ''}`, detail: v.doctor ? `Doctor: ${v.doctor}` : undefined });
    }
    for (const r of (ipdRecords || [])) {
      items.push({ date: r.date, kind: 'ipd', title: r.type, detail: r.summary });
    }
    return items
      .filter(it => it.date)
      .sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visits, ipdRecords]);

  // Fetch prescription history for this patient (doctor-scope endpoint for doctors, public for others)
  const { data: prescriptions = [] } = useQuery<any[]>({
    queryKey: ['patient-prescriptions', patientId, isDoctor],
    queryFn: async () => {
      if (!patientId) return [];
      const token = localStorage.getItem('token');
      const url = isDoctor
        ? `/api/doctor/prescriptions?patientId=${patientId}`
        : `/api/patients/prescriptions?patientId=${patientId}`;
      try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token || ''}` } });
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) return [];
          throw new Error('Failed to load prescriptions');
        }
        return await res.json();
      } catch (e) {
        console.warn('Prescription fetch failed; skipping in UI', e);
        return [];
      }
    },
    enabled: !!patientId,
    refetchInterval: 10000,
  });
  const [isAdmissionModalOpen, setIsAdmissionModalOpen] = React.useState(false);

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Patient Not Found</h1>
          <p className="text-muted-foreground">
            No patient data was found. Please try searching again.
          </p>
        </div>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Return to Search
        </Button>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleDeleteVisit = (visit: Visit) => {
    if (!window.confirm('Delete this visit permanently?')) return;
    const allTokens = JSON.parse(localStorage.getItem('tokens') || '[]');
    const remaining = allTokens.filter((t: any) => {
      const samePatient = (t.mrNumber === patient.mrNumber || t.phone === patient.phone);
      return !(samePatient && t.dateTime === visit.dateTime);
    });
    localStorage.setItem('tokens', JSON.stringify(remaining));

    const newVisits = visits.filter(v => v.dateTime !== visit.dateTime);
    setVisits(newVisits);

    toast.success('Token/visit has been removed');
  };

  const handleAdmissionSubmit = async (payload: Partial<IpdAdmissionCreatePayload>) => {
    try {
      await admitPatient(payload);
      toast.success('Patient admitted successfully!');
      setIsAdmissionModalOpen(false);
      navigate('/ipd/admissions');
    } catch (error) {
      console.error('Admission failed:', error);
      toast.error('Failed to admit patient. Check console for details.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {isAdmissionModalOpen && (
        <AdmissionDialog
          isOpen={isAdmissionModalOpen}
          onClose={() => setIsAdmissionModalOpen(false)}
          onSubmit={handleAdmissionSubmit}
          patient={{ id: patient.mrNumber, name: patient.name }}
        />
      )}

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Patient Medical History</h1>
      </div>

      {/* Patient Profile Card */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-white shadow">
              <AvatarFallback className="bg-blue-100 text-blue-800 text-xl font-bold">
                {getInitials(patient.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-grow">
              <CardTitle className="text-2xl flex flex-wrap items-center gap-2">
                <User className="h-6 w-6" />
                {patient.name}
                <Badge variant="outline" className="ml-2">
                  MR#: {patient.mrNumber}
                </Badge>
              </CardTitle>
              <CardDescription className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
                <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {patient.phone}</span>
                <span className="flex items-center gap-1"><User className="h-4 w-4" /> {patient.age} years, {patient.gender}</span>
                {patient.address && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {patient.address}</span>}
              </CardDescription>
            </div>
            <Button 
              size="sm" 
              onClick={() => setIsAdmissionModalOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Admit to IPD
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-full">
              <Calendar className="h-6 w-6 text-blue-800" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Visits</p>
              <p className="text-xl font-bold">{visits.length}</p>
            </div>
          </div>
          
          {visits.length > 0 && (
            <>
              <div className="bg-green-50 p-4 rounded-lg flex items-center gap-3">
                <div className="bg-green-100 p-3 rounded-full">
                  <Clock className="h-6 w-6 text-green-800" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Visit</p>
                  <p className="text-xl font-bold">
                    {new Date(visits[0].dateTime).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg flex items-center gap-3">
                <div className="bg-purple-100 p-3 rounded-full">
                  <Stethoscope className="h-6 w-6 text-purple-800" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Department</p>
                  <p className="text-xl font-bold">{visits[0].department}</p>
                </div>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-lg flex items-center gap-3">
                <div className="bg-amber-100 p-3 rounded-full">
                  <DollarSign className="h-6 w-6 text-amber-800" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Fee</p>
                  <p className="text-xl font-bold">Rs. {visits[0].fee}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            <span>Patient Timeline (OPD + IPD)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {combinedTimeline.length > 0 ? (
            <div className="space-y-4">
              {combinedTimeline.map((item, index) => (
                <div key={index} className="border-l-2 border-blue-200 pl-6 pb-6 relative">
                  <div className="absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-blue-600 border-4 border-white shadow"></div>
                  <div className="bg-white rounded-lg shadow-sm p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        {item.kind === 'visit' ? 'OPD Visit' : item.title}
                        <Badge variant="outline" className="text-sm">
                          {new Date(item.date).toLocaleDateString()}
                        </Badge>
                      </h3>
                        {isAdmin && item.kind==='visit' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteVisit(visits.find(v=>v.dateTime===item.date)!)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                    {item.kind==='visit' ? (
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Stethoscope className="h-4 w-4" /> Doctor
                          </p>
                          <p className="font-medium">{visits.find(v=>v.dateTime===item.date)?.doctor}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Activity className="h-4 w-4" /> Department
                          </p>
                          <p className="font-medium">{visits.find(v=>v.dateTime===item.date)?.department}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4" /> Fee
                          </p>
                          <p className="font-medium">Rs. {visits.find(v=>v.dateTime===item.date)?.fee}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-700">{item.detail}</div>
                    )}
                    
                    {item.kind==='visit' && (visits.find(v=>v.dateTime===item.date)?.symptoms) && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm font-medium flex items-start gap-2">
                          <Activity className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span><span className="font-semibold">Symptoms:</span> {visits.find(v=>v.dateTime===item.date)?.symptoms}</span>
                        </p>
                      </div>
                    )}
                    
                    {item.kind==='visit' && (visits.find(v=>v.dateTime===item.date)?.diagnosis) && (
                      <div className="bg-green-50 p-3 rounded-lg">
                        <p className="text-sm font-medium">
                          <span className="font-semibold">Diagnosis:</span> {visits.find(v=>v.dateTime===item.date)?.diagnosis}
                        </p>
                      </div>
                    )}
                    
                    {item.kind==='visit' && (visits.find(v=>v.dateTime===item.date)?.prescription) && (
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-sm font-medium flex items-start gap-2">
                          <Clipboard className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span><span className="font-semibold">Prescription:</span> {visits.find(v=>v.dateTime===item.date)?.prescription}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No OPD/IPD history found for this patient</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prescription History */}
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Clipboard className="h-5 w-5" />
            <span>Prescription History</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {Array.isArray(prescriptions) && prescriptions.length > 0 ? (
            prescriptions.map((p: any) => (
              <div key={p.id || p._id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{new Date(p.createdAt).toLocaleString()}</div>
                  {p.status && <span className="text-sm text-muted-foreground">{p.status}</span>}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Patient: {p.patient?.name} {p.patient?.mrNumber && `(${p.patient.mrNumber})`}
                </div>
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Items</div>
                  <ul className="list-disc pl-5 text-sm">
                    {(p.items || []).map((it: any, idx: number) => (
                      <li key={idx}>{it.medicineName || it.medicine}{it.dosage ? ` — ${it.dosage}` : ''}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No prescriptions found for this patient</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientHistory;

function buildVisitsFromTokens(tokens: any[]): Visit[] {
  return tokens.map(t => ({
    dateTime: t.dateTime,
    doctor: t.doctor,
    department: t.department,
    fee: t.finalFee?.toString() || t.fee?.toString() || '0',
    symptoms: t.symptoms || '',
    diagnosis: t.diagnosis || '',
    prescription: t.prescription || ''
  })).sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
}
