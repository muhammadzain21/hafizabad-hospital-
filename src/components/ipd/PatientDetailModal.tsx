import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bed, IpdAdmission, usePatient, useDoctor } from '@/hooks/useIpdApi';
import { BedDouble, User, Stethoscope, Calendar, AlertTriangle, Building2, Tag, CircleDollarSign } from 'lucide-react';
import { BedActionDialog } from './BedActionDialog'; // Assuming this component exists

interface Props {
  open: boolean;
  bed: Bed | null;
  admission?: IpdAdmission;
  onClose: () => void;
  onDischarge: (admissionId: string) => void;
  onEdit: (bed: Bed, updates: Partial<Bed>) => void;
  onDelete: (bed: Bed) => void;
}

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center text-sm">
    <Icon className="w-4 h-4 mr-3 text-gray-500" />
    <span className="font-medium text-gray-600 w-24">{label}:</span>
    <span className="text-gray-800 font-semibold">{value}</span>
  </div>
);

const PatientDetailModal: React.FC<Props> = ({ open, bed, admission, onClose, onDischarge, onEdit, onDelete }) => {
  const navigate = useNavigate();

  // Safely extract patient and doctor IDs (handles populated objects or plain strings)
  const patientIdStr: string = (() => {
    const pid: any = admission?.patientId ?? '';
    if (!pid) return '';
    return typeof pid === 'object' ? pid._id : pid;
  })();
  const doctorIdStr: string = (() => {
    const did: any = admission?.doctorId ?? '';
    if (!did) return '';
    return typeof did === 'object' ? did._id : did;
  })();

  // Fetch latest patient / doctor details
  const { data: patient } = usePatient(patientIdStr || '');
  const { data: doctor } = useDoctor(doctorIdStr || '');

  const [isBedActionOpen, setBedActionOpen] = useState(false);

  // Pre-compute display names with graceful fallbacks
  const patientName = patient?.name || (admission && typeof admission.patientId === 'object' ? admission.patientId.name : admission?.patientName) || 'N/A';
  const doctorName = doctor?.name || (admission && admission.doctorId && typeof admission.doctorId === 'object' ? admission.doctorId.name : 'N/A');

  const handleViewProfile = () => {
    if (!admission) return;
    // Ensure we navigate with a string ID even if patientId is populated object
    navigate(`/ipd/patients/${patientIdStr}`);
    onClose();
  };

  if (!bed) return null;

  // Derive ward name and other bed fields with fallbacks
  const wardName = (bed as any)?.wardId?.name || (bed as any)?.ward?.name || 'N/A';
  const category = (bed as any)?.category || 'N/A';
  const rent = (bed as any)?.rent != null ? (bed as any).rent : 'N/A';

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg bg-background">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center">
              <BedDouble className="w-6 h-6 mr-3 text-primary" />
              Bed Details: {bed.bedNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 px-2 space-y-4">
            {/* Patient & Admission */}
            <DetailRow icon={User} label="Patient" value={patientName} />
            <DetailRow icon={Stethoscope} label="Doctor" value={doctorName} />
            <DetailRow icon={Calendar} label="Admitted" value={admission ? new Date(admission.admitDateTime).toLocaleString() : 'N/A'} />

            {/* Bed Info */}
            <div className="h-px w-full bg-border my-2" />
            <DetailRow icon={Building2} label="Ward" value={wardName} />
            <DetailRow icon={Tag} label="Category" value={category} />
            <DetailRow icon={CircleDollarSign} label="Rent / day" value={rent !== 'N/A' ? `Rs. ${rent}` : 'N/A'} />
            <DetailRow icon={AlertTriangle} label="Status" value={bed.status} />
          </div>
          <DialogFooter className="mt-4 gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setBedActionOpen(true)}>Edit Bed</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleViewProfile} disabled={!admission}>View Profile</Button>
              <Button variant="destructive" onClick={() => onDischarge(admission!._id)} disabled={!admission}>Discharge</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bed Action Dialog for editing/deleting */}
      <BedActionDialog
        bed={bed}
        admission={admission}
        open={isBedActionOpen}
        onOpenChange={setBedActionOpen}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  );
};

export default PatientDetailModal;
