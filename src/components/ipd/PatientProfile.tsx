import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdmissions, usePatient, useBeds, useDoctors, useWards } from '@/hooks/useIpdApi';
import { VitalsTab } from './VitalsTab';
import { MedicationTab } from './MedicationTab';
import { LabTestsTab } from './LabTestsTab';
import { DoctorVisitsTab } from './DoctorVisitsTab';
import { BillingTab } from './BillingTab';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DischargeFormModal } from '@/components/ipd/DischargeFormModal';
import { ShortStayModal } from '@/components/ipd/ShortStayModal';

/*
  PatientProfile
  ---------------
  Displays a single admitted patient's profile with the following tabs:
  1. Vitals & Notes
  2. Medication
  3. Lab Tests
  4. Doctor Visits
  5. Billing

  For this first iteration we simply fetch the patient's current admission and show
  stub placeholders for each tab. These can later be replaced with dedicated
  components as functionality is built out.
*/

const PatientProfile: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { data: admissions = [] } = useAdmissions();
  const { data: patient, isLoading: isPatientLoading } = usePatient(patientId);
  const { data: beds = [] } = useBeds();
  const { data: doctors = [] } = useDoctors();
  const { data: wards = [] } = useWards();
  const [activeTab, setActiveTab] = useState<'vitals' | 'medication' | 'labs' | 'visits' | 'billing'>('vitals');
  const [showDischargeActions, setShowDischargeActions] = useState(false);
  const [showDischargeSlipModal, setShowDischargeSlipModal] = useState(false);
  const [showShortStayModal, setShowShortStayModal] = useState(false);
  const navigate = useNavigate();

  // locate active admission by patientId
  const admission = admissions.find(a => {
    if (!patientId) return false;
    return typeof a.patientId === 'string' ? a.patientId === patientId : a.patientId?._id === patientId;
  });

  if (isPatientLoading) {
    return <div className="p-6">Loading patient details...</div>;
  }

  if (!admission) {
    return (
      <div className="p-6">
        <p className="text-red-600 font-semibold">Patient admission not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/ipd/patients">Back to Patients</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-xl">{patient?.name || admission.patientName || 'Patient Profile'}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div>Bed: <span className="font-medium text-primary">{beds.find(b => b._id === admission.bedId)?.bedNumber || 'N/A'}</span></div>
          <div>Doctor: {doctors.find(d => d._id === admission.doctorId)?.name || 'N/A'}</div>
          <div>Admitted: {new Date(admission.admitDateTime).toLocaleString()}</div>
          {admission.status !== 'Admitted' && (
            <div>Status: {admission.status}</div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v)=> setActiveTab(v as any)} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="vitals">Vitals & Notes</TabsTrigger>
          <TabsTrigger value="medication">Medication</TabsTrigger>
          <TabsTrigger value="labs">Lab Tests</TabsTrigger>
          <TabsTrigger value="visits">Doctor Visits</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>
        {/* Vitals & Notes */}
        <TabsContent value="vitals">
          <VitalsTab admissionId={admission._id} />
        </TabsContent>
        {/* Medication */}
        <TabsContent value="medication">
          <MedicationTab admissionId={admission._id} />
        </TabsContent>
        {/* Lab Tests */}
        <TabsContent value="labs">
          <LabTestsTab admissionId={admission._id} />
        </TabsContent>
        {/* Doctor Visits */}
        <TabsContent value="visits">
          <DoctorVisitsTab admissionId={admission._id} />
        </TabsContent>
        {/* Billing */}
        <TabsContent value="billing">
          <BillingTab admissionId={admission._id} />
        </TabsContent>
      </Tabs>

      {/* Discharge Actions Modal */}
      <Dialog open={showDischargeActions} onOpenChange={setShowDischargeActions}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Discharge Actions</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowDischargeActions(false);
                setShowDischargeSlipModal(true);
              }}
            >
              Discharge Slip
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowDischargeActions(false); setShowShortStayModal(true); }}
            >
              Short Stay
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDischargeActions(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discharge Slip as native modal (no navigation) */}
      {(() => {
        const pid = (patientId || (typeof admission?.patientId === 'string' ? (admission?.patientId as string) : (admission?.patientId as any)?._id)) as string | undefined;
        return (
          <DischargeFormModal
            open={showDischargeSlipModal}
            onOpenChange={setShowDischargeSlipModal}
            patientId={pid || ''}
            admissionId={admission._id}
          />
        );
      })()}

      {/* Invoice and death-related modals removed with Corporate portal */}
      {/* Short Stay modal */}
      <ShortStayModal open={showShortStayModal} onOpenChange={setShowShortStayModal} />
    </div>
  );
};

export default PatientProfile;
