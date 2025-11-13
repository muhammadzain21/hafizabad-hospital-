import React, { useState } from 'react';
import { useCreateAdmission } from '@/hooks/useIpdApi';
import { useIpdContext } from '@/pages/Ipd';
import PatientSearch from '@/components/PatientSearch';
import AdmissionDialog from './AdmissionDialog';
import { Patient } from '@/hooks/usePatientApi';
import { IpdAdmission, Bed } from '@/hooks/useIpdApi';
import { Doctor } from '@/types/Doctor';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Eye, PlusCircle } from 'lucide-react';

export const IpdAdmissions: React.FC = () => {
  const { admissions, doctors, beds, isFetchingAdmissions } = useIpdContext();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Admitted' | 'Discharged' | 'All'>('Admitted');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const createAdmission = useCreateAdmission();

  const getDoctorName = (doctorId: string) => doctors.find(d => d._id === doctorId)?.name || 'N/A';
  
  const getBedInfo = (bedId: string) => {
    const bed = beds.find(b => b._id === bedId);
    if (!bed) return 'N/A';
    const wardName = (bed.wardId && typeof bed.wardId === 'object') ? bed.wardId.name : 'N/A';
    return `${wardName} / ${bed.bedNumber}`;
  };

  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient);
    setIsSearchModalOpen(false);
  };

  const handleSubmitAdmission = async (payload: any) => {
    if (!selectedPatient) return;

    await createAdmission.mutateAsync(payload, {
      onSuccess: () => {
        toast.success(`Patient ${selectedPatient.name} admitted successfully!`);
        setSelectedPatient(null);
      },
      onError: (error) => {
        const errorMessage = (error as any).response?.data?.message || 'Failed to admit patient.';
        toast.error(errorMessage);
        console.error('Admission Error:', error);
      },
    });
  };

  const filteredAdmissions = React.useMemo(() => {
    return admissions.filter(a => {
      const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
      if (!matchesStatus) return false;

      const lowerCaseQuery = query.toLowerCase();
      const doctorName = getDoctorName(a.doctorId).toLowerCase();
      const bedInfo = getBedInfo(a.bedId).toLowerCase();

      const patient = a.patientId;
      const patientName = (patient && typeof patient === 'object' && patient.name) ? patient.name.toLowerCase() : '';
      const patientMr = (patient && typeof patient === 'object' && patient.mrNumber) ? patient.mrNumber.toLowerCase() : '';

      return (
        query === '' ||
        patientName.includes(lowerCaseQuery) ||
        patientMr.includes(lowerCaseQuery) ||
        doctorName.includes(lowerCaseQuery) ||
        bedInfo.includes(lowerCaseQuery)
      );
    });
  }, [admissions, query, statusFilter, doctors, beds]);

  // Reset to first page when filters/search change
  React.useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAdmissions.length / pageSize));
  const pagedAdmissions = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAdmissions.slice(start, start + pageSize);
  }, [filteredAdmissions, page, pageSize]);

  const SkeletonRow = () => (
    <TableRow>
      <TableCell>
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-24 bg-gray-100 rounded mt-2 animate-pulse" />
      </TableCell>
      <TableCell><div className="h-4 w-44 bg-gray-200 rounded animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></TableCell>
      <TableCell><div className="h-4 w-36 bg-gray-200 rounded animate-pulse" /></TableCell>
      <TableCell><div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse" /></TableCell>
      <TableCell className="text-right"><div className="h-8 w-8 bg-gray-100 rounded-full inline-block animate-pulse" /></TableCell>
    </TableRow>
  );

  return (
    <>
      <Card className="border-0 shadow-none">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <CardTitle className='text-2xl'>Admissions</CardTitle>
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
            <div className="flex items-center gap-2">
                <Button onClick={() => setIsSearchModalOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> New Admission
                </Button>
            </div>
            <div className="relative w-full sm:w-auto sm:max-w-xs">
              <Input
                placeholder="Search..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-10 w-full rounded-lg shadow-sm border-gray-300 focus:border-indigo-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isFetchingAdmissions && filteredAdmissions.length === 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Admission Date</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Ward/Bed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: Math.min(5, pageSize) }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </TableBody>
            </Table>
          ) : filteredAdmissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Admission Date</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Ward/Bed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedAdmissions.map(admission => (
                  <TableRow key={admission._id}>
                    <TableCell className="font-medium">
                      <div>{typeof admission.patientId === 'object' ? admission.patientId.name : 'Patient Name N/A'}</div>
                      <div className="text-xs text-gray-500">{typeof admission.patientId === 'object' ? admission.patientId.mrNumber : 'MR # N/A'}</div>
                    </TableCell>
                    <TableCell>{new Date(admission.admitDateTime).toLocaleString()}</TableCell>
                    <TableCell>{getDoctorName(admission.doctorId)}</TableCell>
                    <TableCell>{getBedInfo(admission.bedId)}</TableCell>
                    <TableCell>
                      <Badge variant={admission.status === 'Admitted' ? 'default' : 'secondary'}>
                        {admission.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {typeof admission.patientId === 'object' && admission.patientId._id && (
                        <Button asChild variant="ghost" size="icon">
                          <Link to={`/ipd/patients/${admission.patientId._id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-gray-500 py-8">No admissions found for the selected filter.</p>
          )}

          {/* Pagination Controls */}
          {filteredAdmissions.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredAdmissions.length)} of {filteredAdmissions.length}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <span className="text-sm">Page {page} / {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </Button>
                <select
                  className="ml-2 border rounded px-2 py-1 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {[10, 20, 50].map(sz => (
                    <option key={sz} value={sz}>{sz} / page</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Search Patient to Admit</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto h-full">
            <PatientSearch onAdmitPatient={handlePatientSelect} />
          </div>
        </DialogContent>
      </Dialog>

      {selectedPatient && (
        <AdmissionDialog
          isOpen={!!selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onSubmit={handleSubmitAdmission}
          patient={{
            id: selectedPatient._id,
            name: selectedPatient.name,
            mrNumber: selectedPatient.mrNumber,
          }}
        />
      )}
    </>
  );
};
