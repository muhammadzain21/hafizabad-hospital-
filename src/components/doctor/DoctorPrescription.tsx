import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, FlaskConical, Printer, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

// Common laboratory tests that doctors frequently order
const generalTests = [
  'Complete Blood Count (CBC)',
  'Blood Sugar (Fasting/Random)',
  'Lipid Profile',
  'Liver Function Tests (LFT)',
  'Renal Function Tests (RFT)',
  'Thyroid Function Tests (TFT)',
  'Urine Routine Examination',
  'X-Ray Chest PA View',
  'ECG',
  'Ultrasound Abdomen',
];

type ItemRow = {
  id: number;
  category?: string; // e.g., Tab, Cap, Syrup, Inj
  medicine: string;
  morning: string;   // tablets in the morning
  afternoon: string; // tablets in the afternoon
  evening: string;   // tablets in the evening
  night?: string;    // tablets at night
  days: string;      // how many days
  quantity: string;  // total units to dispense
  instruction?: string; // override dosage string with Urdu instructions
  mealTiming?: 'before' | 'after' | 'during';
  minutesOffset?: string; // minutes before/after meal
  everyNDays?: string; // dose every N days
  everyXHours?: string; // dose every X hours
  alternateDay?: boolean; // دن چھوڑ کر
  weeklyDays?: string[]; // selected days in a week
  prn?: boolean; // حسب ضرورت
  bedtime?: boolean; // سونے وقت
  immediate?: boolean; // اسی وقت
  waterInstruction?: 'plain' | 'warm' | 'dissolve' | '';
};

interface PrescriptionData {
  patientId: string;
  items: { medicineName: string; dosage: string; quantity: number }[];
  tests: string[];
  notesEnglish: string;
  referredToPharmacy: boolean;
  referredToLab: boolean;
}

type Props = { defaultPatientId?: string; tokenId?: string; editPrescription?: any };

const DoctorPrescription: React.FC<Props> = ({ defaultPatientId, tokenId, editPrescription }) => {
  /* ------------------------------------------------------------------ */
  const { user } = useAuth();
  const doctorId = user?.id;
  const [doctorProfile, setDoctorProfile] = useState<any>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [items, setItems] = useState<ItemRow[]>([{ id: 1, category: 'Tab', medicine: '', morning: '', afternoon: '', evening: '', night: '', days: '', quantity: '' }]);
  // Plan panel removed
  const [notesEnglish, setNotesEnglish] = useState('');
  // Medicine search data
  const [allMedicines, setAllMedicines] = useState<string[]>([]);
  const [activeMedicineRowId, setActiveMedicineRowId] = useState<number | null>(null);
  const [referredToPharmacy, setReferredToPharmacy] = useState(false);
  const [referredToLab, setReferredToLab] = useState(false);
  const [patientId, setPatientId] = useState(defaultPatientId || '');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState<{ _id: string; name: string; mrNumber?: string }[]>([]);
  const [tests, setTests] = useState<{ id: number; test: string }[]>([]);
  const [newTest, setNewTest] = useState('');
  // Track the prescription that was last saved so we can print / download
  const [savedPrescription, setSavedPrescription] = useState<any | null>(null);


  // Toggle selection for pre-defined general tests
  // ------------------- UI helper functions -------------------
  const toggleGeneralTest = (testName: string) => {
    const alreadySelected = tests.some(t => t.test === testName);
    if (alreadySelected) {
      setTests(prev => prev.filter(t => t.test !== testName));
    } else {
      setTests(prev => [...prev, { id: Date.now(), test: testName }]);
    }
  };

  const handleGeneralSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValues = Array.from(e.target.selectedOptions).map(opt => opt.value as string);
    setTests(prev => {
      const custom = prev.filter(t => !generalTests.includes(t.test));
      const newSel = selectedValues.map(v => ({ id: Date.now() + Math.random(), test: v }));
      const merged = [...custom, ...newSel];
      return merged.filter((obj, idx, self) => idx === self.findIndex(o => o.test === obj.test));
    });
  };

  const { data: prescriptions = [], refetch } = useQuery<any[]>({
    queryKey: ['doctor-prescriptions', doctorId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/doctor/history/${patientId}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load prescriptions');
      const data = await res.json();
      return Array.isArray(data) ? data : data.prescriptions || [];
    },
    enabled: !!doctorId && !!patientId,
  });

  const submitMutation = useMutation({
    mutationFn: async (newPrescription: any) => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/doctor/prescriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify(newPrescription)
      });
      if (!res.ok) throw new Error('Failed to save prescription');
      return res.json();
    },
    onSuccess: async (data:any) => {
      // Immediately show in UI & print
      setSavedPrescription(data);
      handlePrint();
  
      // Refresh related doctor widgets and lists
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['doctor-dashboard', doctorId] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-queue', doctorId] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-consultations-history', doctorId] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-prescriptions', doctorId] }),
      ]);

      refetch();
      setItems([{ id: 1, medicine: '', morning: '', afternoon: '', evening: '', days: '', quantity: '' }]);
      setNotesEnglish('');
    }
  });

  const submitPrescription = async (): Promise<any> => {
    if (!patientId) throw new Error('Patient is required');
    
    const prescriptionData: PrescriptionData = {
      patientId,
      // Normalize items to backend schema
      items: items
        .filter(it => it.medicine && (it.morning || it.afternoon || it.evening || it.days || it.quantity))
        .map(it => {
          const m = Number(it.morning) || 0;
          const a = Number(it.afternoon) || 0;
          const e = Number(it.evening) || 0;
          const n = Number(it.night) || 0;
          const d = Number(it.days) || 0;
          const suggestedQty = (m + a + e + n) * d;
          const qty = Number(it.quantity) || (suggestedQty || 1);
          // If a custom Urdu instruction exists, use it as dosage text
          const dosage = it.instruction && it.instruction.trim().length > 0
            ? it.instruction
            : `${m}-${a}-${e}-${n}${d ? ` for ${d} day${d === 1 ? '' : 's'}` : ''}`;
          const name = it.medicine;
          return {
            medicineName: name,
            dosage,
            quantity: qty,
          };
        }) as any,
      // Send tests as string[]
      tests: tests.filter(t => t.test).map(t => t.test) as any,
      notesEnglish,
      referredToPharmacy,
      referredToLab
    };
    const payload = { ...prescriptionData, tokenId } as any;

    // Create or Update depending on editPrescription
    let res;
    if (editPrescription?.id) {
      const token = localStorage.getItem('token');
      const putRes = await fetch(`/api/doctor/prescriptions/${editPrescription.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify(payload)
      });
      if (!putRes.ok) throw new Error('Failed to update prescription');
      res = await putRes.json();
      // Invalidate queries after update
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['doctor-dashboard', doctorId] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-queue', doctorId] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-consultations-history', doctorId] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-prescriptions', doctorId] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-prescriptions-list', doctorId] }),
      ]);
    } else {
      // Use doctor-scoped endpoint
      res = await submitMutation.mutateAsync(payload);
    }
    return res;
  };

  const addRow = () => {
    setItems(prev => [...prev, { id: Date.now(), category: 'Tab', medicine: '', morning: '', afternoon: '', evening: '', night: '', days: '', quantity: '' }]);
  };

  const updateRow = (id: number, field: keyof ItemRow, value: string) => {
    setItems(prev => prev.map(row => {
      if (row.id !== id) return row;
      const next = { ...row, [field]: value } as ItemRow;
      // If any schedule field changed, recalc quantity = (M + A + E) * Days
      if (field === 'morning' || field === 'afternoon' || field === 'evening' || field === 'night' || field === 'days') {
        const m = Number(next.morning) || 0;
        const a = Number(next.afternoon) || 0;
        const e = Number(next.evening) || 0;
        const n = Number(next.night) || 0;
        const d = Number(next.days) || 0;
        const suggested = (m + a + e + n) * d;
        next.quantity = suggested ? String(suggested) : '';
      }
      return next;
    }));
  };

  useEffect(() => {
    const fetchPatients = async () => {
      if (patientSearch.length < 2) return setPatientSuggestions([]);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/doctor/patients?q=${encodeURIComponent(patientSearch)}`, {
          headers: {
            Authorization: `Bearer ${token || ''}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setPatientSuggestions(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatients();
  }, [patientSearch, doctorId]);

  // Load medicines once for typeahead (API first, fallback to localStorage)
  useEffect(() => {
    const loadMedicines = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/medicines', { headers: { Authorization: `Bearer ${token || ''}` } });
        if (res.ok) {
          const data = await res.json();
          const names = Array.isArray(data)
            ? data.map((m:any) => m.name || m.medicineName).filter(Boolean)
            : Array.isArray(data?.medicines) ? data.medicines.map((m:any)=> m.name || m.medicineName).filter(Boolean) : [];
          if (names.length) { setAllMedicines(names); return; }
        }
      } catch (e) {
        // ignore and try fallback
      }
      try {
        const local = JSON.parse(localStorage.getItem('medicines') || '[]');
        const names = local.map((m:any)=> m.name).filter(Boolean);
        setAllMedicines(names);
      } catch {}
    };
    loadMedicines();
  }, []);

  // Initialize from defaultPatientId when it changes
  useEffect(() => {
    if (defaultPatientId) setPatientId(defaultPatientId);
  }, [defaultPatientId]);

  // Prefill when editing an existing prescription
  useEffect(() => {
    if (editPrescription) {
      setPatientId(editPrescription.patient?._id || editPrescription.patientId || '');
      // map items to local rows
      const categories = ['Tab','Cap','Syrup','Inj','Drops','Cream','Oint','Susp','Sachet','Neb','Other'];
      const mappedItems = (editPrescription.items || []).map((it: any, idx: number) => {
        const full = it.medicineName || it.medicine || '';
        // Try to parse a leading "Category: Name" pattern
        let category: string | undefined = undefined;
        let name = full;
        const m = full.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
        if (m && categories.includes(m[1])) {
          category = m[1];
          name = m[2];
        }
        return {
          id: Date.now() + idx,
          category: category || 'Tab',
          medicine: name,
          dosage: it.dosage || '',
          quantity: String(it.quantity || 1),
          morning: '',
          afternoon: '',
          evening: '',
          night: '',
          days: '',
        } as ItemRow;
      });
      setItems(
        mappedItems.length
          ? mappedItems
          : [{ id: 1, category: 'Tab', medicine: '', morning: '', afternoon: '', evening: '', night: '', days: '', quantity: '' }]
      );
      const mappedTests = (editPrescription.tests || []).map((t: string, idx: number) => ({ id: Date.now() + idx, test: t }));
      setTests(mappedTests);
      setNotesEnglish(editPrescription.notesEnglish || '');
      setReferredToLab(!!editPrescription.referredToLab);
      setReferredToPharmacy(!!editPrescription.referredToPharmacy);
    }
  }, [editPrescription]);

  // Lab tests helper functions
  const addTest = () => {
    setTests(prev => [...prev, { id: Date.now(), test: '' }]);
  };
  const updateTest = (id: number, value: string) => {
    setTests(prev => prev.map(t => (t.id === id ? { ...t, test: value } : t)));
  };
  const removeTest = (id: number) => {
    setTests(prev => prev.filter(t => t.id !== id));
  };

  const buildPrintableHTML = (prescription: any) => {
    const patient = prescription.patient || {};
    const items = prescription.items || [];
    const createdAt = prescription.createdAt ? new Date(prescription.createdAt) : new Date();
    const doctorName = user?.name || doctorProfile?.name || 'Doctor';
    const hospital = 'Chemma Heart Complex';
    const doctorDept = doctorProfile?.specialization || (user as any)?.department || 'OPD';

    const styles = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
        .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 16px; }
        .title { font-size: 22px; font-weight: 700; }
        .sub { font-size: 12px; color: #6B7280; }
        .section { margin-top: 12px; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; }
        .section h3 { margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; }
        .row { display: flex; flex-wrap: wrap; gap: 12px; }
        .field { flex: 1; min-width: 180px; font-size: 13px; }
        .label { color: #6B7280; font-size: 12px; }
        .value { font-weight: 600; }
        ol { margin: 0; padding-left: 18px; }
        li { margin: 6px 0; font-size: 14px; }
        .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 12px; color: #6B7280; }
        @media print { .no-print { display: none; } }
      </style>
    `;

    const itemsHtml = items.map((it: any, idx: number) => {
      const name = it.medicineName || it.medicine || '-';
      const dosage = it.dosage ? ` — ${it.dosage}` : '';
      const qty = it.quantity ? ` (Qty: ${it.quantity})` : '';
      return `<li>${name}${dosage}${qty}</li>`;
    }).join('');

    return `<!doctype html><html><head><meta charset="utf-8"/>${styles}</head><body>
      <div class="header">
        <div class="title">${hospital}</div>
        <div class="sub">Prescription</div>
      </div>
      <div class="section">
        <h3>Doctor</h3>
        <div class="row">
          <div class="field"><div class="label">Name</div><div class="value">${doctorName}</div></div>
          <div class="field"><div class="label">Department</div><div class="value">${doctorDept}</div></div>
          <div class="field"><div class="label">Date</div><div class="value">${createdAt.toLocaleString()}</div></div>
        </div>
      </div>
      <div class="section">
        <h3>Patient</h3>
        <div class="row">
          <div class="field"><div class="label">Name</div><div class="value">${patient?.name || '-'}</div></div>
          <div class="field"><div class="label">MR Number</div><div class="value">${patient?.mrNumber || '-'}</div></div>
          <div class="field"><div class="label">Guardian</div><div class="value">${[patient?.guardianRelation, patient?.guardianName].filter(Boolean).join(' ') || '-'}</div></div>
          <div class="field"><div class="label">CNIC</div><div class="value">${patient?.cnic || '-'}</div></div>
          <div class="field"><div class="label">Age</div><div class="value">${patient?.age ?? '-'}</div></div>
          <div class="field"><div class="label">Gender</div><div class="value">${patient?.gender || '-'}</div></div>
          <div class="field"><div class="label">Phone</div><div class="value">${patient?.phone || '-'}</div></div>
          <div class="field"><div class="label">Address</div><div class="value">${patient?.address || '-'}</div></div>
        </div>
      </div>
      <div class="section">
        <h3>Prescription Items</h3>
        <ol>${itemsHtml}</ol>
      </div>
      <div class="footer">
        <div>Powered by Mindspire HMS</div>
        <div>Signature ____________________</div>
      </div>
    </body></html>`;
  };

  const handlePrint = () => {
    if (!savedPrescription) {
      toast({
        title: 'Error',
        description: 'Please save the prescription first',
        variant: 'destructive'
      });
      return;
    }
    const html = buildPrintableHTML(savedPrescription);
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Give the browser a moment to layout before printing
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
    }
    toast({
      title: 'Success',
      description: 'Prescription sent to printer',
      variant: 'default'
    });
  };

  const handleSubmit = async () => {
    try {
      const result = await submitPrescription();
      setSavedPrescription(result);
      toast({
        title: 'Success',
        description: 'Prescription saved successfully!',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save prescription',
        variant: 'destructive'
      });
    }
  };

  const handleReferToPharmacy = async (checked: boolean) => {
    setReferredToPharmacy(checked);
    if (checked) {
      try {
        // Save the prescription with referral flag
        await submitPrescription();
        toast({
          title: 'Success',
          description: 'Patient referred to pharmacy',
          variant: 'default'
        });
        // Stay on the same page (Prescription History). No navigation.
      } catch (e:any) {
        toast({ title: 'Error', description: e?.message || 'Failed to refer to Pharmacy', variant: 'destructive' });
      }
    }
  };

  const handleReferToLab = async (checked: boolean) => {
    setReferredToLab(checked);
    if (checked) {
      try {
        await submitPrescription();
        toast({
          title: 'Success',
          description: 'Patient referred to lab',
          variant: 'default'
        });
        // Stay on the same page (Prescription History). No navigation.
      } catch (e:any) {
        toast({ title: 'Error', description: e?.message || 'Failed to refer to Lab', variant: 'destructive' });
      }
    }
  };

  const handleAddMedicine = () => {
    addRow();
  };

  const handleItemChange = (id: number, field: keyof ItemRow, value: string) => {
    updateRow(id, field, value);
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleAddTest = () => {
    if (!newTest.trim()) return;
    setTests(prev => [...prev, { id: Date.now(), test: newTest }]);
    setNewTest('');
  };

  const handleRemoveTest = (id: number) => {
    setTests(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Patient Selection Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Patient Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Input 
                  placeholder="Search patient by name or MR#"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pr-10"
                />
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
              
              {patientSuggestions.length > 0 && (
                <div className="border rounded-lg p-2 max-h-40 overflow-y-auto">
                  {patientSuggestions.map((patient) => (
                    <div 
                      key={patient._id}
                      className="p-2 hover:bg-accent rounded cursor-pointer"
                      onClick={() => {
                        setPatientId(patient._id);
                        setPatientSearch(patient.name + (patient.mrNumber ? ` (${patient.mrNumber})` : ''));
                        setPatientSuggestions([]);
                      }}
                    >
                      {patient.name} {patient.mrNumber && <span className="text-muted-foreground">({patient.mrNumber})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Prescription Actions Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Prescription Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button variant="outline" onClick={handleAddMedicine}>
                <Plus className="mr-2 h-4 w-4" /> Add Medicine
              </Button>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="pharmacy" 
                  checked={referredToPharmacy}
                  onCheckedChange={handleReferToPharmacy}
                  className="hidden"
                />
                <Label htmlFor="pharmacy" className="cursor-pointer">
                  <Button 
                    variant={referredToPharmacy ? 'default' : 'outline'}
                    className="flex items-center gap-2"
                    onClick={() => handleReferToPharmacy(!referredToPharmacy)}
                  >
                    <FlaskConical className="h-4 w-4" />
                    Refer to Pharmacy
                  </Button>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="lab" 
                  checked={referredToLab}
                  onCheckedChange={handleReferToLab}
                  className="hidden"
                />
                <Label htmlFor="lab" className="cursor-pointer">
                  <Button 
                    variant={referredToLab ? 'default' : 'outline'}
                    className="flex items-center gap-2"
                    onClick={() => handleReferToLab(!referredToLab)}
                  >
                    <FlaskConical className="h-4 w-4" />
                    Refer to Lab
                  </Button>
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Medicines Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Medicines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Header row for clarity on small screens */}
            <div className="hidden md:grid grid-cols-12 gap-4 text-sm text-muted-foreground">
              <div className="col-span-4">Medicine</div>
              <div className="col-span-1 text-center">M</div>
              <div className="col-span-1 text-center">A</div>
              <div className="col-span-1 text-center">E</div>
              <div className="col-span-1 text-center">N</div>
              <div className="col-span-2 text-center">Days</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-1"></div>
            </div>
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 items-start border-b pb-2">
                <div className="col-span-12 md:col-span-4 relative">
                  <Input
                    placeholder="Medicine name"
                    value={item.medicine}
                    onChange={(e) => handleItemChange(item.id, 'medicine', e.target.value)}
                    onFocus={() => setActiveMedicineRowId(item.id)}
                    onBlur={() => setTimeout(()=> setActiveMedicineRowId(prev => prev===item.id ? null : prev), 150)}
                  />
                  {activeMedicineRowId === item.id && (item.medicine?.trim().length ?? 0) > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow max-h-48 overflow-auto">
                      {allMedicines
                        .filter(n => n && n.toLowerCase().includes((item.medicine||'').toLowerCase()))
                        .slice(0, 10)
                        .map(name => (
                          <div
                            key={name}
                            className="px-2 py-1 hover:bg-accent cursor-pointer text-sm"
                            onMouseDown={(e)=>{ e.preventDefault(); handleItemChange(item.id,'medicine', name); setActiveMedicineRowId(null); }}
                          >
                            {name}
                          </div>
                        ))}
                      {allMedicines.filter(n => n && n.toLowerCase().includes((item.medicine||'').toLowerCase())).length === 0 && (
                        <div className="px-2 py-2 text-xs text-muted-foreground">No matches</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Input
                    type="number"
                    min={0}
                    placeholder="M"
                    value={item.morning}
                    onChange={(e) => handleItemChange(item.id, 'morning', e.target.value)}
                  />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Input
                    type="number"
                    min={0}
                    placeholder="A"
                    value={item.afternoon}
                    onChange={(e) => handleItemChange(item.id, 'afternoon', e.target.value)}
                  />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Input
                    type="number"
                    min={0}
                    placeholder="E"
                    value={item.evening}
                    onChange={(e) => handleItemChange(item.id, 'evening', e.target.value)}
                  />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <Input
                    type="number"
                    min={0}
                    placeholder="N"
                    value={item.night || ''}
                    onChange={(e) => handleItemChange(item.id, 'night', e.target.value)}
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Days"
                    value={item.days}
                    onChange={(e) => handleItemChange(item.id, 'days', e.target.value)}
                  />
                </div>
                <div className="col-span-6 md:col-span-1">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                  />
                </div>
                <div className="col-span-12 md:col-span-1 flex justify-end md:justify-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
                
                </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lab Tests Card */}
      {referredToLab && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Laboratory Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {generalTests.map((test) => (
                  <Badge 
                    key={test}
                    variant={tests.some(t => t.test === test) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleGeneralTest(test)}
                  >
                    {test}
                  </Badge>
                ))}
              </div>
              
              <div className="flex items-center gap-4">
                <Input 
                  placeholder="Add custom test"
                  value={newTest}
                  onChange={(e) => setNewTest(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddTest} disabled={!newTest.trim()}>
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
              
              {tests.length > 0 && (
                <div className="border rounded-lg p-4 space-y-2">
                  {tests.map((test) => (
                    <div key={test.id} className="flex justify-between items-center">
                      <span>{test.test}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveTest(test.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Clinical Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="notes-english">English Notes</Label>
            <Textarea 
              id="notes-english"
              placeholder="Enter clinical notes in English"
              value={notesEnglish}
              onChange={(e) => setNotesEnglish(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit / Print Buttons */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleSubmit} size="lg" className="px-8">
          Save Prescription
        </Button>
        <Button onClick={handlePrint} size="lg" variant="outline" disabled={!savedPrescription}>
          Print
        </Button>
      </div>
    </div>
  );
};

export default DoctorPrescription;
