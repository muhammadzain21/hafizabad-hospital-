import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IpdAdmission } from '@/hooks/useIpdApi';
import { useIpdContext } from '@/pages/Ipd';
import { Patient } from '@/hooks/usePatientApi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle, BedDouble, CalendarDays, Stethoscope, ClipboardList, Search, FileQuestion, FileBadge } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMrNumber } from '@/lib/utils';

const PatientInfo: React.FC<{ patient: Patient, admissionDate: string }> = ({ patient, admissionDate }) => {
  if (!patient) return null;

  return (
    <>
      <CardTitle className="text-lg font-bold text-gray-800 truncate">
        {patient.name}
      </CardTitle>
      <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileBadge className="h-4 w-4" />
          <span>{formatMrNumber(patient.mrNumber, admissionDate)}</span>
        </div>
    </>
  );
};

const PatientCardSkeleton: React.FC = () => (
  <Card className="rounded-lg overflow-hidden">
    <CardHeader>
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="pt-4 space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-10 w-full mt-4" />
    </CardContent>
  </Card>
);

const PatientCard: React.FC<{ admission: IpdAdmission; doctorName: string; bedNumber: string; }> = ({ admission, doctorName, bedNumber }) => {
  const patient = admission.patientId as Patient;

  const statusColor = admission.status === 'Admitted' ? 'border-green-500' : 'border-gray-300';
  return (
    <Card className={`group hover:shadow-xl transition-shadow duration-300 rounded-lg overflow-hidden border-l-4 ${statusColor}`}>
      <CardHeader>
        <div className="flex items-center gap-4">
          <UserCircle className="h-12 w-12 text-indigo-500 flex-shrink-0" />
          <div className="flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {patient && <PatientInfo patient={patient} admissionDate={admission.admitDateTime} />}
            </div>
            <Badge className="mt-1" variant={admission.status === 'Admitted' ? 'default' : 'secondary'}>
              {admission.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-4 px-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-indigo-400 flex-shrink-0" />
            <span className="font-medium text-gray-600">Doctor:</span>
            <span className="truncate">{doctorName}</span>
          </div>
          <div className="flex items-center gap-2">
            <BedDouble className="h-4 w-4 text-indigo-400 flex-shrink-0" />
            <span className="font-medium text-gray-600">Bed:</span>
            <span className="truncate">{bedNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-400 flex-shrink-0" />
            <span className="font-medium text-gray-600">Admitted:</span>
            <span className="truncate">{new Date(admission.admitDateTime).toLocaleDateString()}</span>
          </div>
          {admission.admittingDiagnosis && (
            <div className="flex items-start gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <span className="font-medium text-gray-600">Diagnosis:</span>
              <span className="flex-1 break-words">{admission.admittingDiagnosis}</span>
            </div>
          )}
        </div>
        <Button asChild className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md">
          <Link to={`/ipd/patients/${patient?._id}`}>View Profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export const PatientList: React.FC = () => {
  const { admissions, doctors, beds } = useIpdContext();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Admitted' | 'Discharged' | 'All'>('Admitted');

  const getDoctorName = (doctorId: string) => doctors.find(d => d._id === doctorId)?.name || 'N/A';
  const getBedNumber = (bedId: string) => beds.find(b => b._id === bedId)?.bedNumber || 'N/A';

  const filteredAdmissions = useMemo(() => {
    return admissions.filter(admission => {
      const patient = admission.patientId as Patient;
      // Defensive check to ensure patient is a populated object
      if (!patient || typeof patient !== 'object') return false; 

      const patientName = patient.name?.toLowerCase() || '';
      const patientMr = patient.mrNumber?.toLowerCase() || '';
      const lowerCaseQuery = query.toLowerCase();

      const matchesQuery = patientName.includes(lowerCaseQuery) || patientMr.includes(lowerCaseQuery);
      const matchesStatus = statusFilter === 'All' || admission.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [admissions, query, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          {(['Admitted', 'Discharged', 'All'] as const).map(status => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1 h-auto transition-colors duration-200 ${statusFilter === status ? 'shadow' : ''}`}
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-auto sm:max-w-xs">
          <Input
            className="pl-10 w-full rounded-lg shadow-sm border-gray-300 focus:border-indigo-500"
            placeholder="Search by name, ID, or doctor..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredAdmissions.length > 0 ? (
          filteredAdmissions.map((admission) => (
            <PatientCard 
              key={admission._id} 
              admission={admission} 
              doctorName={getDoctorName(admission.doctorId)} 
              bedNumber={getBedNumber(admission.bedId)} 
            />
          ))
        ) : (
          <div className="col-span-full text-center py-10">
            <FileQuestion className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Patients Found</h3>
            <p className="mt-1 text-sm text-gray-500">No patients match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};
