import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ReceivedDeathCertificatePage33 from '@/components/receive death';
import BrandedHeader from '@/components/corporate/BrandedHeader';
import { get as apiGet, put as apiPut } from '@/lib/api';

export const ReceivedDeathModal: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void; patientId: string }>=({ open, onOpenChange, patientId })=>{
  const [patient, setPatient] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{ if(!open || !patientId) return; (async()=>{
    try{
      const p = await apiGet<any>(`/api/corporate/patients/${patientId}`);
      setPatient(p?.patient || p || null);
    } catch { setPatient(null); }
  })(); }, [open, patientId]);

  const printView = () => {
    const el = printRef.current; if (!el) return;
    const style = `
      <style>
        @page { size: A4; margin: 12mm; }
        *{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:18px;color:#111}
        img{max-height:70px;width:auto;}
        .print-hide{display:none !important}
        .brand{display:flex;gap:10px;align-items:center;justify-content:center;text-align:center;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid #bae6fd}
        .brand .logoimg{width:56px;height:56px;object-fit:contain;border:1px solid #bae6fd;border-radius:8px;background:#fff;margin-right:8px}
        .brand .title1{font-weight:900;text-transform:uppercase;letter-spacing:.3px;font-size:24px;line-height:1.1;color:#1d4ed8}
        .brand .title2{font-weight:900;text-transform:uppercase;font-size:18px;line-height:1.1;color:#1d4ed8;margin-top:4px}
        .brand .addr{color:#475569;font-size:12px;margin-top:2px}
      </style>`;
    const logoAbs = new URL('/logo-cheema.png.png', window.location.origin).toString();
    const brand = `
      <div class=\"brand\">
        <img class=\"logoimg\" src=\"${logoAbs}\" alt=\"Logo\" onerror=\"this.style.display='none'\" />
        <div>
          <div class=\"title1\">CHEEMA HEART COMPLEX</div>
          <div class=\"title2\">& GENERAL HOSPITAL</div>
          <div class=\"addr\">Mian Zia-ul-Haq Road, Near Lords Hotel, District Courts Gujranwala.</div>
          <div class=\"addr\">Tel: 055-325 59 59, 373 15 59. Mob. 0300-964 92 91</div>
          <div class=\"addr\">E-mail: cheemaheartcomplex@gmail.com</div>
        </div>
      </div>`;
    const html = `<!doctype html><html><head><meta charset=\"utf-8\">${style}</head><body>${brand}${el.innerHTML}</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const save = async () => {
    if (!patientId) return;
    const payload: any = {
      mrn: patient?.mrn || patient?.mrNumber,
      patientName: patient?.name,
      attendantName: '',
      attendantCnic: ''
    };
    await apiPut(`/api/corporate/patients/${patientId}/received-death`, payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Received Death</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 px-2">
          {patient && (
            <div className="text-xs text-slate-700 bg-slate-50 border rounded p-2">
              <div><b>Patient:</b> {patient?.name||'—'} <b>MR#:</b> {patient?.mrn||patient?.mrNumber||'—'} <b>Phone:</b> {patient?.phone||'—'}</div>
            </div>
          )}
          <BrandedHeader compact logoUrl="/logo-cheema.png.png" />
          <div ref={printRef}>
            <ReceivedDeathCertificatePage33 patient={patient} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={printView}>Print</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
