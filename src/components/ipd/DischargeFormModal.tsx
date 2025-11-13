import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { put as apiPut, get as apiGet, api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

// Types (mirroring the ones used in components/Discharged.tsx)
type Medicine = { name: string; strengthDose: string; route: string; frequency: string; timing: string; duration: string };
type Investigations = { hb?: string; urea?: string; hcv?: string; na?: string; platelets?: string; creatinine?: string; hbsag?: string; k?: string; tlc?: string; alt?: string; hiv?: string; ca?: string };

type DischargeForm = {
  dor?: string;
  lama: boolean;
  dischargedAdvisedByDoctor: boolean;
  ddrConsent: boolean;
  presentingComplaints: string;
  admissionReason: string;
  finalDiagnosis: string;
  proceduresAndOutcome: string;
  treatmentInHospital: string;
  investigations: Investigations;
  medicines: Medicine[];
  conditionAtDischarge: 'satisfactory'|'fair'|'poor'|'';
  responseOfTreatment: 'excellent'|'good'|'average'|'poor'|'';
  followUpInstructions: string;
  doctorName: string;
  doctorSign: string;
  signDate?: string;
};

export const DischargeFormModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  admissionId: string;
}> = ({ open, onOpenChange, patientId, admissionId }) => {
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const printRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const [form, setForm] = useState<DischargeForm>({
    dor: '', lama: false, dischargedAdvisedByDoctor: false, ddrConsent: false, presentingComplaints: '', admissionReason: '', finalDiagnosis: '', proceduresAndOutcome: '', treatmentInHospital: '', investigations: {}, medicines: Array.from({length:6}).map(()=>({ name:'', strengthDose:'', route:'', frequency:'', timing:'', duration:'' })), conditionAtDischarge: '', responseOfTreatment: '', followUpInstructions: '', doctorName:'', doctorSign:'', signDate: ''
  });

  // Load patient context only (corporate portal removed)
  useEffect(()=>{ if (!open || !patientId) return; (async()=>{
    try {
      setError('');
      const p = await apiGet<any>(`/patients/${patientId}`).catch(()=>null as any);
      setPatient(p || null);
      // Existing discharge fetch removed
    } catch (e: any){ setError(e?.message||'Failed to load patient'); }
  })(); }, [open, patientId]);

  const save = async () => {
    if (!patientId) { alert('Missing patient id'); return; }
    if (!admissionId) { alert('Missing admission id'); return; }
    setSaving(true);
    try {
      // Map UI form -> IPD dischargeSummary schema
      const inv = form.investigations || {};
      const investigations = {
        HB: inv.hb || '',
        UREA: inv.urea || '',
        HCV: inv.hcv || '',
        NA: inv.na || '',
        PLATELETS: inv.platelets || '',
        CREATININE: inv.creatinine || '',
        HBSAG: inv.hbsag || '',
        K: inv.k || '',
        TLC: inv.tlc || '',
        ALT: inv.alt || '',
        HIV: inv.hiv || '',
        CA: inv.ca || '',
        other: '',
      } as any;

      const medicinesOnDischarge = (form.medicines || [])
        .filter((m: Medicine) => Object.values(m).some(v => String(v || '').trim() !== ''))
        .map((m, idx) => ({
          sr: idx + 1,
          medicine: m.name,
          strengthDose: m.strengthDose,
          route: m.route,
          frequency: m.frequency,
          timing: m.timing,
          duration: m.duration,
        }));

      const dischargeSummary = {
        investigations,
        medicinesOnDischarge,
        conditionAtDischarge: form.conditionAtDischarge || 'satisfactory',
        responseOfTreatment: form.responseOfTreatment || 'good',
        followUpInstructions: form.followUpInstructions || '',
        doctorName: form.doctorName || '',
        doctorSignText: form.doctorSign || '',
        signDate: form.signDate ? new Date(form.signDate).toISOString() : undefined,
        amount: amount.trim() === '' ? 0 : Number(amount),
        discount: discount.trim() === '' ? 0 : Number(discount),
        remarks: '',
      };

      // Call IPD discharge endpoint (this also frees the bed and flips status)
      await api.patch(`/ipd/admissions/${admissionId}/discharge`, { dischargeSummary });

      // Create a Finance income record for discharge amount if provided
      const amtNum = Number(dischargeSummary.amount || 0);
      if (amtNum > 0) {
        try {
          await api.post('/ipd/finance', {
            date: new Date().toISOString(),
            amount: amtNum,
            category: 'Discharge',
            description: 'Discharge billing recorded from IPD profile',
            type: 'Income',
            department: 'IPD',
            patientId,
            admissionId,
          });
        } catch (finErr) {
          console.warn('Failed to create finance record for discharge:', finErr);
        }
      }

      // Invalidate and force-refetch admissions and beds to refresh UI tabs and lists immediately
      await qc.invalidateQueries({ queryKey: ['admissions'] });
      await qc.invalidateQueries({ queryKey: ['admissions', 'light'] });
      await qc.invalidateQueries({ queryKey: ['beds'] });
      await qc.refetchQueries({ queryKey: ['admissions', 'light'] });
      await qc.refetchQueries({ queryKey: ['beds'] });
      await qc.refetchQueries({ queryKey: ['ipd-finance'] });

      alert('Discharge saved successfully');
      onOpenChange(false);
    } catch (e: any) {
      console.error('Save discharge failed', e);
      alert(`Save failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const setInv = (key: keyof Investigations, value: string) => setForm(m=> ({ ...m, investigations: { ...(m.investigations||{}), [key]: value } }));

  const printView = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const style = `
      <style>
        @page { size: A4; margin: 12mm; }
        *{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#111}
        .brand{display:flex;gap:10px;align-items:center;justify-content:center;text-align:center;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid #bae6fd}
        .brand .logoimg{width:56px;height:56px;object-fit:contain;border:1px solid #bae6fd;border-radius:8px;background:#fff;margin-right:8px}
        .brand .title1{font-weight:900;text-transform:uppercase;letter-spacing:.3px;font-size:24px;line-height:1.1;color:#1d4ed8}
        .brand .title2{font-weight:900;text-transform:uppercase;font-size:18px;line-height:1.1;color:#1d4ed8;margin-top:4px}
        .brand .addr{color:#475569;font-size:12px;margin-top:2px}
        .section{border:2px solid #111;padding:10px;margin-top:10px}
        .title{text-align:center;font-weight:700;font-size:18px;margin-bottom:6px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:6px}
        .label{color:#444;width:170px;display:inline-block}
        table{width:100%;border-collapse:collapse;margin-top:6px}
        th,td{border:1px solid #111;padding:4px 6px;font-size:12px}
        th{background:#f5f5f5}
      </style>`;
    const logoAbs = new URL('/logo-cheema.png.png', window.location.origin).toString();
    const brand = `
      <div class="brand">
        <img class="logoimg" src="${logoAbs}" alt="Logo" onerror="this.style.display='none'" />
        <div>
          <div class="title1">CHEEMA HEART COMPLEX</div>
          <div class="title2">& GENERAL HOSPITAL</div>
          <div class="addr">Mian Zia-ul-Haq Road, Near Lords Hotel, District Courts Gujranwala.</div>
          <div class="addr">Tel: 055-325 59 59, 373 15 59. Mob. 0300-964 92 91</div>
          <div class="addr">E-mail: cheemaheartcomplex@gmail.com</div>
        </div>
      </div>`;
    const headGrid = `
      <div class="grid">
        <div><span class="label">MR #</span> ${patient?.mrn||patient?.mrNumber||''}</div>
        <div><span class="label">Date</span> ${new Date().toLocaleDateString()}</div>
        <div><span class="label">Patient Name</span> ${patient?.name||''}</div>
        <div><span class="label">Phone</span> ${patient?.phone||''}</div>
        <div><span class="label">Address</span> ${escapeHtml(patient?.address||'')}</div>
      </div>`;
    const inv = form.investigations||{} as any;
    const meds = (form.medicines||[]).filter(m=>Object.values(m).some(v=>String(v||'').trim()!==''));
    const medRows = meds.map((m,idx)=>`<tr>
      <td>${idx+1}</td><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.strengthDose)}</td>
      <td>${escapeHtml(m.route)}</td><td>${escapeHtml(m.frequency)}</td>
      <td>${escapeHtml(m.timing)}</td><td>${escapeHtml(m.duration)}</td>
    </tr>`).join('');
    const investigations = `
      <table>
        <thead><tr>
          <th>HB</th><th>UREA</th><th>HCV</th><th>NA</th><th>PLATELETS</th><th>CREATININE</th>
          <th>HBSAG</th><th>K</th><th>TLC</th><th>ALT</th><th>HIV</th><th>CA</th>
        </tr></thead>
        <tbody><tr>
          <td>${escapeHtml(inv.hb||'')}</td><td>${escapeHtml(inv.urea||'')}</td><td>${escapeHtml(inv.hcv||'')}</td><td>${escapeHtml(inv.na||'')}</td><td>${escapeHtml(inv.platelets||'')}</td><td>${escapeHtml(inv.creatinine||'')}</td>
          <td>${escapeHtml(inv.hbsag||'')}</td><td>${escapeHtml(inv.k||'')}</td><td>${escapeHtml(inv.tlc||'')}</td><td>${escapeHtml(inv.alt||'')}</td><td>${escapeHtml(inv.hiv||'')}</td><td>${escapeHtml(inv.ca||'')}</td>
        </tr></tbody>
      </table>`;
    const html = `<!doctype html><html><head><meta charset="utf-8">${style}</head><body>
      ${brand}
      <div class="section">
        <div class="title">Discharge Summary</div>
        ${headGrid}
        <div class="grid"><div><span class="label">Date of Release (DOR)</span> ${escapeHtml(form.dor||'')}</div><div><span class="label">Discharged by Doctor</span> ${form.dischargedAdvisedByDoctor? 'Yes':'No'}</div></div>
        <div><b>Presenting Complaints:</b><br/>${escapeHtml(form.presentingComplaints||'')}</div>
        <div style="margin-top:6px"><b>Reason of Admission / Brief History / Examination:</b><br/>${escapeHtml(form.admissionReason||'')}</div>
        <div style="margin-top:6px"><b>Final Diagnosis:</b><br/>${escapeHtml(form.finalDiagnosis||'')}</div>
        <div style="margin-top:6px"><b>Any Procedure During Stay & Outcome:</b><br/>${escapeHtml(form.proceduresAndOutcome||'')}</div>
        <div style="margin-top:6px"><b>Treatment in Hospital:</b><br/>${escapeHtml(form.treatmentInHospital||'')}</div>
        <div style="margin-top:10px"><b>Investigations Significant Results</b>${investigations}</div>
        <div style="margin-top:10px"><b>Medicines on Discharge</b>
          <table>
            <thead><tr><th>Sr</th><th>Medicine</th><th>Strength/Dose</th><th>Route</th><th>Frequency</th><th>Timing</th><th>Duration</th></tr></thead>
            <tbody>${medRows}</tbody>
          </table>
        </div>
        <div class="grid" style="margin-top:10px">
          <div><span class="label">Condition at Discharge</span> ${escapeHtml(form.conditionAtDischarge||'')}</div>
          <div><span class="label">Response of Treatment</span> ${escapeHtml(form.responseOfTreatment||'')}</div>
        </div>
        <div style="margin-top:6px"><b>Follow-up Instructions:</b><br/>${escapeHtml(form.followUpInstructions||'')}</div>
        <div class="grid" style="margin-top:10px">
          <div><span class="label">Doctor Name</span> ${escapeHtml(form.doctorName||'')}</div>
          <div><span class="label">Sign Date</span> ${escapeHtml(form.signDate||'')}</div>
        </div>
        <div class="grid"><div><span class="label">Doctor Sign</span> ${escapeHtml(form.doctorSign||'')}</div></div>
        <div class="grid" style="margin-top:10px">
          <div><span class="label">Amount</span> ${Number(amount||0).toLocaleString()}</div>
          <div><span class="label">Discount</span> ${Number(discount||0).toLocaleString()}</div>
        </div>
      </div>
    </body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  function escapeHtml(s: any){
    return String(s||'').replace(/[&<>"]+/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' } as any)[c]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Discharge Form</DialogTitle>
        </DialogHeader>
        {patient && (
          <div className="text-xs text-slate-700 bg-slate-50 border rounded p-2 mb-2">
            <div><b>Patient:</b> {patient?.name||'—'} <b>MR#:</b> {patient?.mrn||patient?.mrNumber||'—'} <b>Phone:</b> {patient?.phone||'—'}</div>
          </div>
        )}
        {!!error && (<div className="text-xs text-red-600 mb-2">{error}</div>)}
        <div ref={printRef}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date of Release (DOR)</label>
            <input type="date" value={form.dor||''} onChange={e=>setForm(m=>({ ...m, dor: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
          <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={form.lama} onChange={e=>setForm(m=>({ ...m, lama: e.target.checked }))} /> <span className="text-sm">LAMA</span></label>
          <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={form.ddrConsent} onChange={e=>setForm(m=>({ ...m, ddrConsent: e.target.checked }))} /> <span className="text-sm">DDR Consent</span></label>
          <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={form.dischargedAdvisedByDoctor} onChange={e=>setForm(m=>({ ...m, dischargedAdvisedByDoctor: e.target.checked }))} /> <span className="text-sm">Discharged advised by Doctor</span></label>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Presenting Complaints</label>
            <textarea value={form.presentingComplaints} onChange={e=>setForm(m=>({ ...m, presentingComplaints: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Reason of Admission / Brief History / Examination</label>
            <textarea value={form.admissionReason} onChange={e=>setForm(m=>({ ...m, admissionReason: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Final Diagnosis</label>
            <textarea value={form.finalDiagnosis} onChange={e=>setForm(m=>({ ...m, finalDiagnosis: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Any Procedure During Stay & Outcome</label>
            <textarea value={form.proceduresAndOutcome} onChange={e=>setForm(m=>({ ...m, proceduresAndOutcome: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Treatment in Hospital</label>
            <textarea value={form.treatmentInHospital} onChange={e=>setForm(m=>({ ...m, treatmentInHospital: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
        </div>

        <div className="mt-4">
          <div className="font-medium text-sm mb-2">Investigations Significant Results</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            {(['hb','urea','hcv','na','platelets','creatinine','hbsag','k','tlc','alt','hiv','ca'] as (keyof Investigations)[]).map(key => (
              <div key={String(key)} className="flex flex-col">
                <label className="text-[10px] uppercase text-slate-500">{String(key)}</label>
                <input value={(form.investigations as any)[key]||''} onChange={e=>setInv(key, e.target.value)} className="border border-sky-200 rounded px-2 py-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="font-medium text-sm mb-2">Medicines given on Discharge</div>
          <div className="overflow-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Sr</th>
                  <th>Medicine</th>
                  <th>Strength/Dose</th>
                  <th>Route</th>
                  <th>Frequency</th>
                  <th>Timing</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {form.medicines.map((mrow, idx)=> (
                  <tr key={idx} className="border-t">
                    <td className="py-1 pr-2">{idx+1}</td>
                    {(['name','strengthDose','route','frequency','timing','duration'] as (keyof Medicine)[]).map((k)=> (
                      <td key={String(k)} className="pr-2 py-1">
                        <input value={(mrow as any)[k]||''} onChange={e=>setForm(m=>{ const list=[...m.medicines]; (list[idx] as any)[k]=e.target.value; return { ...m, medicines: list }; })} className="border border-sky-200 rounded px-2 py-1 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">Condition at Discharge</div>
            <div className="flex gap-3 text-sm">
              {(['satisfactory','fair','poor'] as const).map(v=> (
                <label key={v} className="flex items-center gap-1">
                  <input type="radio" checked={form.conditionAtDischarge===v} onChange={()=>setForm(m=>({ ...m, conditionAtDischarge: v }))} /> {v}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-slate-500 mb-1">Response of Treatment</div>
            <div className="flex gap-3 text-sm flex-wrap">
              {(['excellent','good','average','poor'] as const).map(v=> (
                <label key={v} className="flex items-center gap-1">
                  <input type="radio" checked={form.responseOfTreatment===v} onChange={()=>setForm(m=>({ ...m, responseOfTreatment: v }))} /> {v}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Follow-up Instructions</label>
            <textarea value={form.followUpInstructions} onChange={e=>setForm(m=>({ ...m, followUpInstructions: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Doctor Name</label>
              <input value={form.doctorName} onChange={e=>setForm(m=>({ ...m, doctorName: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Sign Date</label>
              <input type="date" value={form.signDate||''} onChange={e=>setForm(m=>({ ...m, signDate: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Doctor Sign (text)</label>
              <input value={form.doctorSign} onChange={e=>setForm(m=>({ ...m, doctorSign: e.target.value }))} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Amount</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Discount</label>
            <input type="number" value={discount} onChange={e=>setDiscount(e.target.value)} className="w-full border border-sky-200 rounded-lg px-3 py-2" />
          </div>
        </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={printView}>Print</Button>
          <Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & Discharge'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
