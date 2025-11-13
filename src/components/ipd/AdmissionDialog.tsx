import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useBeds, useDoctors, IpdAdmissionCreatePayload } from '@/hooks/useIpdApi';
import { useCorporatePanels } from '@/hooks/useApi';
import { toast } from 'sonner';

interface AdmissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<IpdAdmissionCreatePayload>) => Promise<void>;
  patient: { id: string; name: string; mrNumber?: string };
}

const AdmissionDialog: React.FC<AdmissionDialogProps> = ({ isOpen, onClose, onSubmit, patient }) => {
  const { data: doctors = [], isLoading: doctorsLoading } = useDoctors();
  const { data: beds = [], isLoading: bedsLoading } = useBeds('Available');
  const { data: panels = [] } = useCorporatePanels();

  const [doctorId, setDoctorId] = useState('');
  const [bedId, setBedId] = useState('');
  const [admittingDiagnosis, setAdmittingDiagnosis] = useState('');
    const [admitSource, setAdmitSource] = useState<'OPD' | 'ER' | 'Direct' | ''>('');
  const [billingType, setBillingType] = useState<'cash' | 'credit'>('cash');
  const [panelId, setPanelId] = useState<string>('');
  const [initialVitals, setInitialVitals] = useState({
    bp: '',
    temp: '',
    pulse: '',
    respiration: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!doctorId || !bedId) {
      toast.error('Please select a doctor and a bed.');
      return;
    }

    if (billingType === 'credit' && !panelId) {
      toast.error('Please select a corporate panel for credit billing.');
      return;
    }

    setIsSubmitting(true);
    await onSubmit({
      patientId: patient.id,
      patientName: patient.name,
      doctorId,
      bedId,
      admittingDiagnosis,
      admitDateTime: new Date().toISOString(),
      status: 'Admitted',
      admitSource: admitSource || undefined,
      initialVitals,
      billingType,
      panelId: billingType === 'credit' ? panelId : undefined,
    });
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Admit Patient: {patient.name} ({patient.mrNumber || 'N/A'})</DialogTitle>
          <DialogDescription>
            Fill in the details below to admit the patient to the IPD.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="doctor">Assign Doctor</Label>
              <Select onValueChange={setDoctorId} value={doctorId} disabled={doctorsLoading}>
                <SelectTrigger id="doctor">
                  <SelectValue placeholder={doctorsLoading ? 'Loading...' : 'Select a doctor'} />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(doc => (
                    <SelectItem key={doc._id} value={doc._id}>{doc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bed">Assign Bed</Label>
              <Select onValueChange={setBedId} value={bedId} disabled={bedsLoading}>
                <SelectTrigger id="bed">
                  <SelectValue placeholder={bedsLoading ? 'Loading...' : 'Select a bed'} />
                </SelectTrigger>
                <SelectContent>
                  {beds.map(bed => {
                    const wardName = typeof bed.wardId === 'object' ? bed.wardId.name : 'N/A';
                    return (
                      <SelectItem key={bed._id} value={bed._id}>{bed.bedNumber} ({wardName})</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="billingType">Billing Type</Label>
              <Select onValueChange={(v: any)=> setBillingType(v as 'cash'|'credit')} value={billingType}>
                <SelectTrigger id="billingType">
                  <SelectValue placeholder="Select billing type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Corporate Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {billingType === 'credit' && (
              <div>
                <Label htmlFor="panel">Corporate Panel</Label>
                <Select onValueChange={setPanelId} value={panelId}>
                  <SelectTrigger id="panel">
                    <SelectValue placeholder="Select panel" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(panels) ? panels : []).map((p: any) => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="admitSource">Admit Source</Label>
            <Select onValueChange={(value: 'OPD' | 'ER' | 'Direct') => setAdmitSource(value)} value={admitSource}>
              <SelectTrigger id="admitSource">
                <SelectValue placeholder="Select admit source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPD">OPD Transfer</SelectItem>
                <SelectItem value="ER">Emergency</SelectItem>
                <SelectItem value="Direct">Direct</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="diagnosis">Admitting Diagnosis</Label>
            <Textarea
              id="diagnosis"
              value={admittingDiagnosis}
              onChange={(e) => setAdmittingDiagnosis(e.target.value)}
              placeholder="Enter admitting diagnosis"
            />
          </div>

          <div>
            <Label className="font-semibold">Initial Vitals</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 p-4 border rounded-lg">
              <div>
                <Label htmlFor="bp" className="text-sm">Blood Pressure</Label>
                <Input id="bp" value={initialVitals.bp} onChange={(e) => setInitialVitals({...initialVitals, bp: e.target.value})} placeholder="e.g., 120/80" />
              </div>
              <div>
                <Label htmlFor="temp" className="text-sm">Temperature (°F)</Label>
                <Input id="temp" type="number" value={initialVitals.temp} onChange={(e) => setInitialVitals({...initialVitals, temp: e.target.value})} placeholder="e.g., 98.6" />
              </div>
              <div>
                <Label htmlFor="pulse" className="text-sm">Pulse (bpm)</Label>
                <Input id="pulse" type="number" value={initialVitals.pulse} onChange={(e) => setInitialVitals({...initialVitals, pulse: e.target.value})} placeholder="e.g., 72" />
              </div>
              <div>
                <Label htmlFor="respiration" className="text-sm">Respiration (rpm)</Label>
                <Input id="respiration" type="number" value={initialVitals.respiration} onChange={(e) => setInitialVitals({...initialVitals, respiration: e.target.value})} placeholder="e.g., 16" />
              </div>
            </div>
          </div>
          
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !doctorId || !bedId}>
            {isSubmitting ? 'Admitting...' : 'Confirm Admission'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdmissionDialog;
