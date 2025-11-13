import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

interface PrescriptionItem {
  medicine?: string;
  medicineName?: string;
  dosage?: string;
}

interface Prescription {
  id?: string;
  _id?: string;
  createdAt: string;
  status?: string;
  items?: PrescriptionItem[];
  referredToPharmacy?: boolean;
  referredToLab?: boolean;
  patient?: {
    _id?: string;
    id?: string;
    name?: string;
    mrNumber?: string;
    phone?: string;
    age?: number | string;
    gender?: string;
    address?: string;
    guardianName?: string;
    guardianRelation?: string;
    cnic?: string;
  };
}

type Prefill = { mrNumber?: string; phone?: string; name?: string };

const PrescriptionHistory: React.FC<{ prefill?: Prefill }> = ({ prefill }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routePrefill: Prefill = (location.state as any)?.prefill || {};

  const [query, setQuery] = React.useState<string>((prefill?.mrNumber || prefill?.phone || prefill?.name || routePrefill.mrNumber || routePrefill.phone || routePrefill.name || ''));

  // Load all prescriptions from server
  const { data: all = [], isLoading, isError } = useQuery<Prescription[]>({
    queryKey: ['all-prescriptions'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/doctor/prescriptions', {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!res.ok) throw new Error('Failed to load prescriptions');
      return res.json();
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const { user } = useAuth();
  const [doctorProfile, setDoctorProfile] = React.useState<any>(null);

  React.useEffect(() => {
    const loadDoctor = async () => {
      try {
        const token = localStorage.getItem('token');
        const id = (user as any)?.doctorId || (user as any)?.id;
        const username = (user as any)?.username;
        if (!id && !username) return;
        const isObjectId = typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
        if (isObjectId) {
          const res = await fetch(`/api/doctors/${id}`, { headers: { Authorization: `Bearer ${token || ''}` } });
          if (res.ok) { setDoctorProfile(await res.json()); return; }
        }
        // Fallback: fetch all and match by username/email or name
        const all = await fetch('/api/doctors', { headers: { Authorization: `Bearer ${token || ''}` } });
        if (all.ok) {
          const list = await all.json();
          const match = Array.isArray(list) ? list.find((d:any) => (
            (username && (d.username === username || d.email === username)) ||
            (user?.name && d.name === user.name)
          )) : null;
          if (match) setDoctorProfile(match);
        }
      } catch {}
    };
    loadDoctor();
  }, [user]);

  const { toast } = useToast();
  const normalized = React.useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) => {
      const name = p.patient?.name?.toLowerCase() || '';
      const phone = p.patient?.phone?.toLowerCase() || '';
      const mr = p.patient?.mrNumber?.toLowerCase() || '';
      return name.includes(q) || phone.includes(q) || mr.includes(q);
    });
  }, [all, query]);

  const buildPrintableHTML = (p: Prescription) => {
    const patient = p.patient || {};
    const items = p.items || [];
    const createdAt = p.createdAt ? new Date(p.createdAt) : new Date();
    const doctorName = user?.name || doctorProfile?.name || 'Doctor';
    const hospital = 'CHEEMA HEART COMPLEX';
    const doctorDept = doctorProfile?.specialization || (user as any)?.department || 'OPD';

    const styles = `
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #111827; padding: 20px; }
        .page { max-width: 800px; margin: 0 auto; }
        /* Brand header styles copied to match Invoice print */
        .brand{display:flex;gap:10px;align-items:center;justify-content:center;text-align:center;padding-bottom:8px;margin-bottom:10px;border-bottom:1px solid #bae6fd}
        .brand .logoimg{width:56px;height:56px;object-fit:contain;border:1px solid #bae6fd;border-radius:8px;background:#fff;margin-right:8px}
        .brand .title1{font-weight:900;text-transform:uppercase;letter-spacing:.3px;font-size:24px;line-height:1.1;color:#1d4ed8}
        .brand .title2{font-weight:900;text-transform:uppercase;font-size:18px;line-height:1.1;color:#1d4ed8;margin-top:4px}
        .brand .addr{color:#475569;font-size:12px;margin-top:2px}
        .section { margin-top: 14px; border: 1px solid #e5e7eb; border-radius: 10px; overflow:hidden; }
        .section .hd { background:#f1f5f9; padding:10px 14px; font-size:13px; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing: .04em; }
        .section .bd { padding: 12px 14px; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
        .field { font-size: 13px; }
        .label { color: #64748b; font-weight: 600; margin-right:6px; }
        .value { color: #0f172a; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; }
        th { background: #f8fafc; text-align: left; }
        .notes { min-height: 120px; border: 2px dashed #94a3b8; padding: 10px; border-radius: 8px; background:#f8fafc; }
        .footer { margin-top: 24px; display:flex; justify-content: space-between; color:#64748b; font-size:12px; }
        .sign { margin-top:40px; text-align:right; }
        @media print {
          body { padding: 0; }
          .no-print { display:none; }
        }
      </style>
    `;

    const itemsTable = `
      <table>
        <thead>
          <tr>
            <th style="width:50%">Medicine</th>
            <th style="width:25%">Dosage</th>
            <th style="width:25%">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it:any) => `
            <tr>
              <td>${it.medicineName || it.medicine || '-'}</td>
              <td>${it.dosage || '-'}</td>
              <td>${(it.quantity ?? '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const logoAbs = new URL('/logo-cheema.png.png', window.location.origin).toString();

    return `<!doctype html><html><head><meta charset="utf-8"/>${styles}</head><body>
      <div class="page">
        <div class="brand">
          <img class="logoimg" src="${logoAbs}" alt="Logo" onerror="this.style.display='none'" />
          <div>
            <div class="title1">${hospital}</div>
            <div class="title2">& GENERAL HOSPITAL</div>
            <div class="addr">Mian Zia-ul-Haq Road, Near Lords Hotel, District Courts Gujranwala.</div>
            <div class="addr">Tel: 055-325 59 59, 373 15 59. Mob. 0300-964 92 91</div>
            <div class="addr">E-mail: cheemaheartcomplex@gmail.com</div>
          </div>
        </div>

        <div class="section" style="margin-top:16px">
          <div class="hd">Doctor Information</div>
          <div class="bd grid">
            <div class="field"><span class="label">Name:</span><span class="value">${doctorName}</span></div>
            <div class="field"><span class="label">Department:</span><span class="value">${doctorDept}</span></div>
            <div class="field"><span class="label">Date:</span><span class="value">${createdAt.toLocaleString()}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="hd">Patient Information</div>
          <div class="bd grid">
            <div class="field"><span class="label">Name:</span><span class="value">${patient?.name || '-'}</span></div>
            <div class="field"><span class="label">MR Number:</span><span class="value">${patient?.mrNumber || '-'}</span></div>
            <div class="field"><span class="label">Guardian:</span><span class="value">${[patient?.guardianRelation, patient?.guardianName].filter(Boolean).join(' ') || '-'}</span></div>
            <div class="field"><span class="label">CNIC:</span><span class="value">${patient?.cnic || '-'}</span></div>
            <div class="field"><span class="label">Age:</span><span class="value">${patient?.age ?? '-'}</span></div>
            <div class="field"><span class="label">Gender:</span><span class="value">${patient?.gender || '-'}</span></div>
            <div class="field"><span class="label">Phone:</span><span class="value">${patient?.phone || '-'}</span></div>
            <div class="field"><span class="label">Address:</span><span class="value">${patient?.address || '-'}</span></div>
          </div>
        </div>

        <div class="section">
          <div class="hd">Medicines</div>
          <div class="bd">${itemsTable}</div>
        </div>

        <div class="section">
          <div class="hd">Clinical Notes</div>
          <div class="bd">
            <div class="notes">${(p as any).notesEnglish || (p as any).notesUrdu || ''}</div>
          </div>
        </div>

        <div class="sign">Doctor Signature ____________________</div>
        <div class="footer">
          <div>Powered by Mindspire HMS</div>
          <div>Printed on ${new Date().toLocaleString()}</div>
        </div>
      </div>
    </body></html>`;
  };

  const printPrescription = (p: Prescription) => {
    try {
      const html = (() => {
        try { return buildPrintableHTML(p); } catch (e: any) {
          console.error('Failed to build printable HTML:', e);
          return `<!doctype html><html><head><meta charset="utf-8"/><title>Prescription</title></head><body><pre style="color:#b91c1c">Failed to build prescription. ${e?.message||e}</pre></body></html>`;
        }
      })();

      // Open a regular about:blank window (avoid noreferrer/noopener that can make it cross-origin in some browsers)
      const win = window.open('about:blank', '_blank', 'width=900,height=700');
      if (!win) {
        // Fallback: print via hidden iframe
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) throw new Error('Print iframe not accessible');
        const safeHtml = html.includes('<title>') ? html : html.replace('<head>', '<head><title>Prescription</title>');
        doc.open();
        doc.write(safeHtml);
        doc.close();
        const doPrint = () => {
          try {
            const w = iframe.contentWindow;
            if (!w) return;
            const remove = () => setTimeout(()=> iframe.remove(), 0);
            // Prefer closing after the user finishes printing
            w.addEventListener?.('afterprint', remove, { once: true } as any);
            w.focus();
            w.print();
            // Fallback: if afterprint never fires, remove after 15s
            setTimeout(remove, 15000);
          } catch { setTimeout(()=> iframe.remove(), 1000); }
        };
        if (doc.readyState === 'complete') setTimeout(doPrint, 150);
        else iframe.addEventListener('load', () => setTimeout(doPrint, 150));
        return;
      }
      // Some browsers need a title for print preview
      const safeHtml = html.includes('<title>') ? html : html.replace('<head>', '<head><title>Prescription</title>');
      win.document.open();
      win.document.write(safeHtml);
      win.document.close();
      // Wait for resources (like logo) to attempt load; then print
      const doPrint = () => {
        try {
          const closeLater = () => setTimeout(() => { try { win.close(); } catch {} }, 0);
          // Close only after user completes/cancels the dialog
          win.addEventListener?.('afterprint', closeLater, { once: true } as any);
          win.focus();
          win.print();
          // Fallback if afterprint doesn't fire (older browsers)
          setTimeout(closeLater, 15000);
        } catch {
          try { win.print(); } catch {}
        }
      };
      // If the new document is readyState complete, print shortly; otherwise hook load
      if (win.document.readyState === 'complete') {
        setTimeout(doPrint, 150);
      } else {
        win.addEventListener('load', () => setTimeout(doPrint, 150));
      }
    } catch (err) {
      console.error('Print error:', err);
      alert('Unable to open print preview. Please allow pop-ups for this site and try again.');
    }
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Prescription History</h1>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, phone, or MR number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-72"
          />
          <Button variant="outline" onClick={() => setQuery('')}>Clear</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Prescriptions {isLoading ? '(Loading...)' : `(${normalized.length})`}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError && (
            <div className="text-red-600">Failed to load prescriptions. Please try again.</div>
          )}
          {Array.isArray(normalized) && normalized.length > 0 ? (
            normalized.map((p) => (
              <div key={p.id || p._id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{new Date(p.createdAt).toLocaleString()}</div>
                  <div className="flex items-center gap-3">
                    {p.status && <span className="text-sm text-muted-foreground">{p.status}</span>}
                    <Button size="sm" variant="outline" onClick={() => printPrescription(p)}>
                      <Printer className="h-4 w-4 mr-1" /> Print
                    </Button>
                    <Button
                      size="sm"
                      variant={p.referredToPharmacy ? 'default' : 'outline'}
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch(`/api/doctor/prescriptions/${p.id || p._id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
                            body: JSON.stringify({ referredToPharmacy: true }),
                          });
                          if (!res.ok) throw new Error('Failed to refer to Pharmacy');
                          // Optimistic UI
                          (p as any).referredToPharmacy = true;
                          toast({ title: 'Referred to Pharmacy', description: 'Referral saved successfully.' });
                        } catch (e) { console.error(e); }
                      }}
                    >
                      Refer to Pharmacy
                    </Button>
                    <Button
                      size="sm"
                      variant={p.referredToLab ? 'default' : 'outline'}
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch(`/api/doctor/prescriptions/${p.id || p._id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
                            body: JSON.stringify({ referredToLab: true }),
                          });
                          if (!res.ok) throw new Error('Failed to refer to Lab');
                          (p as any).referredToLab = true;
                          toast({ title: 'Referred to Lab', description: 'Referral saved successfully.' });
                        } catch (e) { console.error(e); }
                      }}
                    >
                      Refer to Lab
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Patient: {p.patient?.name} {p.patient?.mrNumber && `(${p.patient.mrNumber})`}
                  {p.patient?.phone ? ` — ${p.patient.phone}` : ''}
                </div>
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Items</div>
                  <ul className="list-disc pl-5 text-sm">
                    {(p.items || []).map((it, idx) => (
                      <li key={idx}>
                        {(it.medicineName || it.medicine) ?? '—'}
                        {it.dosage ? ` — ${it.dosage}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">No prescriptions found.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PrescriptionHistory;
