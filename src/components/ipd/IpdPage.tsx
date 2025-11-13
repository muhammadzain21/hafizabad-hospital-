import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmissions, useBeds, useDoctors, admitPatient } from '@/hooks/useIpdApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import heroImg from '@/assets/ipd-hero.svg';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PatientSearch from '@/components/PatientSearch';

export interface AdmissionFormData {
  patientId: string;
  patientName: string;
  doctorId: string;
  bedId: string;
  admitDateTime: string;
  diagnosis: string;
}

const IpdPage: React.FC = () => {
  const { user } = useAuth();
  const { data: admissions = [], refetch: refetchAdmissions } = useAdmissions();
  const { data: beds = [] } = useBeds();
  const { data: doctors = [] } = useDoctors();
  
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<{id: string; name: string} | null>(null);
  const [formData, setFormData] = useState<AdmissionFormData>({
    patientId: '',
    patientName: '',
    doctorId: '',
    bedId: '',
    admitDateTime: new Date().toISOString(),
    diagnosis: ''
  });

  const handleAdmitPatient = async () => {
    try {
      await admitPatient({
        ...formData,
        patientId: selectedPatient?.id || formData.patientId,
        patientName: selectedPatient?.name || formData.patientName,
        status: 'Admitted'
      });
      refetchAdmissions();
      setShowAdmissionModal(false);
      setSelectedPatient(null);
      setFormData({
        patientId: '',
        patientName: '',
        doctorId: '',
        bedId: '',
        admitDateTime: new Date().toISOString(),
        diagnosis: ''
      });
    } catch (error) {
      console.error('Failed to admit patient:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl shadow-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
        <div className="p-8 md:p-16 lg:p-20 flex flex-col md:flex-row items-center gap-8 md:gap-16">
          <div className="flex-1 z-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              In-Patient Department
            </h1>
            <p className="text-white/90 text-lg mb-6 max-w-md">
              Manage patient admissions, bed allocation and discharge processes.
            </p>
            <Button 
              variant="outline" 
              className="bg-white/10 hover:bg-white/20 border-white/30"
              onClick={() => setShowAdmissionModal(true)}
            >
              New Admission
            </Button>
          </div>
          <img
            src={heroImg}
            alt="IPD Illustration"
            className="w-48 md:w-56 lg:w-64 drop-shadow-xl"
          />
        </div>
        {/* decorative blurred blob */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-cyan-400/30 rounded-full filter blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-400/30 rounded-full filter blur-3xl" />
      </section>

      {/* Admission Modal */}
      <Dialog open={showAdmissionModal} onOpenChange={setShowAdmissionModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New IPD Admission</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <PatientSearch 
              onSelectPatient={(patient) => {
                setSelectedPatient(patient);
                setFormData(prev => ({
                  ...prev,
                  patientId: patient.id,
                  patientName: patient.name
                }));
              }}
            />
            
            {(selectedPatient || !selectedPatient) && (
              <div className="space-y-4">
                {!selectedPatient && (
                  <div className="space-y-2">
                    <Label>Patient Name</Label>
                    <Input 
                      value={formData.patientName}
                      onChange={(e) => setFormData({...formData, patientName: e.target.value})}
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Doctor</Label>
                    <Select onValueChange={(value) => setFormData({...formData, doctorId: value})}>
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
                    <Label>Select Bed</Label>
                    <Select onValueChange={(value) => setFormData({...formData, bedId: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bed" />
                      </SelectTrigger>
                      <SelectContent>
                        {beds.filter(b => b.status === 'Available').map(bed => (
                          <SelectItem key={bed._id} value={bed._id}>
                            {bed.wardId && (typeof bed.wardId === 'string' ? bed.wardId : bed.wardId.name)} / {bed.bedNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Diagnosis</Label>
                  <Input 
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({...formData, diagnosis: e.target.value})}
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAdmissionModal(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAdmitPatient}
                    disabled={!formData.doctorId || !formData.bedId || (!selectedPatient && !formData.patientName)}
                  >
                    Admit Patient
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IpdPage;
