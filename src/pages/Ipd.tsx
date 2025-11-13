import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmissions, useBeds, useDoctors, admitPatient, Ward, Bed, IpdAdmission, IpdAdmissionCreatePayload, useUpdateBed, useDeleteBed } from '@/hooks/useIpdApi';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import heroImg from '@/assets/doctor-hero.svg';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import PatientSearch from '@/components/PatientSearch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BedPlan } from '@/components/ipd/BedPlan';

import { PatientList } from '@/components/ipd/PatientList';
import { useLocation, Outlet, useOutletContext } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { IpdDashboard } from '../components/ipd/IpdDashboard';
import { IpdAdmissions as Admissions } from '@/components/ipd/Admissions';
import PatientProfile from '@/components/ipd/PatientProfile';
import Schedule from '@/components/ipd/Schedule';
import IpdFinance from '@/components/ipd/IpdFinance';
import { Doctor } from '@/types/Doctor';
import { toast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/layouts/AdminLayout';

export interface AdmissionFormData {
  patientId: string;
  patientName: string;
  doctorId: string;
  bedId: string;
  admitDateTime: string;
  admittingDiagnosis: string;
  initialVitals: {
    bp: string;
    temp: string;
    pulse: string;
    resp: string;
  };
  notes: string;
  status?: 'Admitted' | 'Discharged' | 'Transferred' | 'Expired';
}

type IpdContextType = {
  admissions: IpdAdmission[];
  beds: Bed[];
  doctors: Doctor[];
  isFetchingAdmissions: boolean;
  isFetchingBeds: boolean;
  handleBedSelect: (bed: Bed) => void;
  handleBedEdit: (bed: Bed, updates: Partial<Bed>) => void;
  handleBedDelete: (bed: Bed) => void;
  setShowAdmissionModal: (show: boolean) => void;
};

export function useIpdContext() {
  return useOutletContext<IpdContextType>();
}

const IpdPage = () => {
  // ...existing hooks and state
  const handleBedEdit = (bed: Bed, updates: Partial<Bed>) => {
    updateBedMutation.mutate({ bedId: bed._id, updates }, {
      onSuccess: () => toast({ title: 'Bed Updated', description: 'The bed information has been successfully updated.' }),
      onError: (error) => toast({ title: 'Error', description: `Failed to update bed: ${error.message}`, variant: 'destructive' }),
    });
  };

  const handleBedDelete = (bed: Bed) => {
    deleteBedMutation.mutate(bed._id, {
      onSuccess: () => toast({ title: 'Bed Deleted', description: 'The bed has been successfully removed.' }),
      onError: (error) => toast({ title: 'Error', description: `Failed to delete bed: ${error.message}`, variant: 'destructive' }),
    });
  };

  const handleBedSelect = (bed: Bed) => {
    setAdmissionForm((prev) => ({ ...prev, bedId: bed._id }));
    setShowAdmissionModal(true);
  };

  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: admissions = [], isLoading: isLoadingAdmissions, isFetching: isFetchingAdmissions, refetch: refetchAdmissions } = useAdmissions();
  const { data: beds = [], isLoading: isLoadingBeds, isFetching: isFetchingBeds, refetch: refetchBeds } = useBeds();
  const { data: doctors = [], isLoading: isLoadingDoctors, isFetching: isFetchingDoctors } = useDoctors();
  const updateBedMutation = useUpdateBed();
  const deleteBedMutation = useDeleteBed();

  const isLoading = false; // Render immediately; avoid gating the whole IPD module
  const isFetchingAny = isFetchingAdmissions || isFetchingBeds || isFetchingDoctors;
  
  const location = useLocation();
  
  // Determine active tab from URL
  const activeTab = location.pathname.includes('/patients') ? 'patients' : 
                    location.pathname.includes('/beds') ? 'beds' :
                    location.pathname.includes('/admissions') ? 'admissions' :
                    location.pathname.includes('/schedule') ? 'schedule' : 'dashboard';

  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{id: string; name: string; mrNumber?: string} | null>(null);
  const [selectedBed, setSelectedBed] = React.useState<Bed | null>(null);
  const [bedActionHandlers, setBedActionHandlers] = React.useState<{
    onEdit: (bed: Bed, updates: Partial<Bed>) => void;
    onDelete: (bed: Bed) => void;
  }>({
    onEdit: () => {},
    onDelete: () => {},
  });
  const [admissionForm, setAdmissionForm] = useState<Partial<IpdAdmissionCreatePayload>>({
    patientId: '',
    patientName: '',
    doctorId: '',
    bedId: '',
    admitDateTime: new Date().toISOString(),
    admittingDiagnosis: '',
    initialVitals: { bp: '', temp: '', pulse: '', resp: '' },
    notes: '',
    status: 'Admitted'
  });

  const handleAdmitPatient = async () => {
    // Client-side validation
    if (!admissionForm.bedId) {
      toast({
        title: 'Select Bed',
        description: 'Please choose an available bed before admitting the patient.',
        variant: 'destructive',
      });
      return;
    }
    try {
      // Find chosen bed in current list; server will perform final availability check
      const bed = beds.find(b => b._id === admissionForm.bedId);
      if (!bed) {
        toast({
          title: 'Invalid Bed',
          description: 'The selected bed is no longer available. Please pick another.',
          variant: 'destructive',
        });
        return;
      }

      const wardIdStr = bed.ward?._id || (typeof bed.ward === 'string' ? bed.ward : 'DemoWard');

      const admissionData: Partial<IpdAdmissionCreatePayload> = {
        ...admissionForm,
        patientId: selectedPatient?.id || admissionForm.patientId,
        patientName: selectedPatient?.name || admissionForm.patientName,
        wardId: wardIdStr,
        status: 'Admitted' as const
      };

      // Call API
      const response = await admitPatient(admissionData);
      
      if (response) {
        toast({
          title: 'Patient Admitted',
          description: (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 animate-bounce" />
              <span>Admission successful</span>
            </div>
          ),
        });
        
        // Reset form and refresh data
        setShowAdmissionModal(false);
        setAdmissionForm({
          patientId: '',
          patientName: '',
          doctorId: '',
          bedId: '',
          admitDateTime: new Date().toISOString(),
          admittingDiagnosis: '',
          initialVitals: { bp: '', temp: '', pulse: '', resp: '' },
          notes: '',
          status: 'Admitted'
        });
        refetchAdmissions();
        qc.invalidateQueries({ queryKey: ['beds'] });
      }
    } catch (error) {
      toast({
        title: 'Admission Failed',
        description: error.response?.data?.error || 'Failed to admit patient',
        variant: 'destructive',
      });
    }
  };

  const availableBeds = beds.filter(b => b.status === 'Available');

  return (
    <AdminLayout>
      <div className="flex flex-col min-h-screen">
        <div className="flex flex-1 relative">
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {/* Always render immediately; show a subtle, non-blocking top loader when fetching */}
            {isFetchingAny && (
              <div className="h-1 w-full mb-2 bg-muted overflow-hidden rounded">
                <div className="h-full w-1/3 bg-primary animate-[loadingBar_1.2s_ease-in-out_infinite]" />
              </div>
            )}
            <Outlet context={{ admissions, beds, doctors, isFetchingAdmissions, isFetchingBeds, handleBedSelect, handleBedEdit, handleBedDelete, setShowAdmissionModal }} />
          </main>
        </div>

      {/* Admission Modal */}
      <Dialog open={showAdmissionModal} onOpenChange={setShowAdmissionModal}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">New Patient Admission</DialogTitle>
            <DialogDescription>
              Fill out all required fields to admit a patient
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patient Search */}
              <div className="space-y-2 col-span-2">
                <Label>Search Existing Patient</Label>
                <PatientSearch 
                  onSelectPatient={setSelectedPatient}
                  onAdmitPatient={(patient: { id: string; name: string; mrNumber?: string }) => {
                    const pid = (patient as any).mrNumber ?? patient.id;
                    setSelectedPatient({ id: pid, name: patient.name, mrNumber: (patient as any).mrNumber });
                    setAdmissionForm((prev) => ({
                      ...prev,
                      patientId: pid,
                      patientName: patient.name,
                      // Optionally prefill other fields if available
                    }));
                    setShowAdmissionModal(true);
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  {selectedPatient 
                    ? `Selected: ${selectedPatient.name}` 
                    : 'Search by MR number, CNIC or phone'}
                </p>
              </div>
              
              {/* Divider */}
              <div className="relative col-span-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    OR
                  </span>
                </div>
              </div>
              
              {/* New Patient Form */}
              <div className="space-y-4 col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="patientName">Patient Name *</Label>
                    <Input
                      id="patientName"
                      value={admissionForm.patientName}
                      onChange={(e) => setAdmissionForm({...admissionForm, patientName: e.target.value})}
                      placeholder="Enter patient name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patientId">MR Number</Label>
                    <Input
                      id="patientId"
                      value={admissionForm.patientId}
                      onChange={(e) => setAdmissionForm({...admissionForm, patientId: e.target.value})}
                      placeholder="Will be auto-generated"
                      disabled={!!selectedPatient}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Select Doctor *</Label>
                    <Select value={admissionForm.doctorId} onValueChange={(value) => setAdmissionForm({ ...admissionForm, doctorId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map(doctor => (
                          <SelectItem key={doctor._id} value={doctor._id}>
                            {doctor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Select Available Bed *</Label>
                    <Select value={admissionForm.bedId} onValueChange={(value) => setAdmissionForm({ ...admissionForm, bedId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bed" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBeds.map(bed => (
                          <SelectItem key={bed._id} value={bed._id}>
                            {bed.ward?._id && (typeof bed.ward === 'string' ? bed.ward : bed.ward.name)} - {bed.bedNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="admittingDiagnosis">Primary Diagnosis *</Label>
                  <textarea
                    id="admittingDiagnosis"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={admissionForm.admittingDiagnosis}
                    onChange={(e) => setAdmissionForm({...admissionForm, admittingDiagnosis: e.target.value})}
                    placeholder="Enter primary diagnosis"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <div className="flex flex-col w-full gap-2">
              <Button 
                onClick={handleAdmitPatient} 
                disabled={!admissionForm.patientName || !admissionForm.doctorId || !admissionForm.bedId}
                className="w-full md:w-auto"
              >
                Admit Patient
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AdminLayout>
  );
};

export default IpdPage;
