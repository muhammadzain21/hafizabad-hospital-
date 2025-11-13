import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ReferredPrescription = {
  _id: string;
  createdAt: string;
  patientId?: string;
  doctorId?: string;
  items: { medicineName: string; dosage: string; quantity: number }[];
  notesEnglish?: string;
  patient?: { name?: string; mrNumber?: string; phone?: string; fatherPhone?: string } | null;
  doctor?: { name?: string } | null;
};

const isMongoId = (s?: string | null) => !!(s && /^[a-fA-F0-9]{24}$/.test(s));

const PatientPrescription: React.FC = () => {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const prescriptionId = params.get('prescriptionId') || '';
  const patientId = params.get('patientId') || '';
  const doctorId = params.get('doctorId') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReferredPrescription | null>(null);
  const [list, setList] = useState<ReferredPrescription[]>([]);
  const [selectedId, setSelectedId] = useState<string>(prescriptionId);
  // pagination state for list view
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalServer, setTotalServer] = useState<number | null>(null);
  // search & sorting
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'patient'|'doctor'|'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        if (selectedId) {
          setLoading(true);
          const res = await fetch(`/api/pharmacy/prescriptions/${selectedId}`);
          if (!res.ok) throw new Error('Failed to load prescription');
          const js: ReferredPrescription = await res.json();
          // Enrich names if missing
          try {
            const updates: Partial<ReferredPrescription> = {};
            if ((!js.patient || !js.patient.name) && isMongoId(js.patientId)) {
              const pr = await fetch(`/api/patients/${js.patientId}`);
              if (pr.ok) {
                const pj = await pr.json();
                updates.patient = { name: pj?.name, mrNumber: pj?.mrNumber, phone: pj?.phone, fatherPhone: pj?.fatherPhone || pj?.fatherNumber };
              }
            }
            if ((!js.doctor || !js.doctor.name) && isMongoId(js.doctorId)) {
              const dr = await fetch(`/api/doctors/${js.doctorId}`);
              if (dr.ok) {
                const dj = await dr.json();
                updates.doctor = { name: dj?.name };
              }
            }
            setData({ ...js, ...updates });
          } catch { setData(js); }
        } else {
          setLoading(true);
          // Server-side pagination + search + sorting (graceful fallback if unsupported)
          const q = new URLSearchParams({
            ...(patientId ? { patientId } : {}),
            ...(doctorId ? { doctorId } : {}),
            page: String(page),
            pageSize: String(pageSize),
            search: searchTerm || '',
            sortBy,
            sortDir
          }).toString();
          const res = await fetch(`/api/pharmacy/prescriptions?${q}`);
          if (!res.ok) throw new Error('Failed to load referrals');
          const js = await res.json();
          const base: ReferredPrescription[] = Array.isArray(js?.referrals) ? js.referrals : Array.isArray(js) ? js : [];
          const totalFromServer = Number(js?.total);
          setTotalServer(Number.isFinite(totalFromServer) ? totalFromServer : null);
          // For any entry lacking embedded names, fetch and enrich
          const enriched = await Promise.all(base.map(async (p) => {
            const out: ReferredPrescription = { ...p } as any;
            try {
              if ((!out.patient || !out.patient.name) && isMongoId(out.patientId)) {
                const pr = await fetch(`/api/patients/${out.patientId}`);
                if (pr.ok) {
                  const pj = await pr.json();
                  out.patient = { name: pj?.name, mrNumber: pj?.mrNumber, phone: pj?.phone, fatherPhone: pj?.fatherPhone || pj?.fatherNumber };
                }
              }
            } catch {}
            try {
              if ((!out.doctor || !out.doctor.name) && isMongoId(out.doctorId)) {
                const dr = await fetch(`/api/doctors/${out.doctorId}`);
                if (dr.ok) {
                  const dj = await dr.json();
                  out.doctor = { name: dj?.name };
                }
              }
            } catch {}
            return out;
          }));
          setList(enriched);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, patientId, doctorId, page, pageSize, searchTerm, sortBy, sortDir]);

  // Reset to first page whenever list changes
  useEffect(() => { setPage(1); }, [list.length]);

  const total = totalServer != null ? totalServer : list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // If server provided paginated results, `list` is already limited
  const paginated = useMemo(() => {
    if (totalServer != null) return list;
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, page, pageSize, totalServer]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-semibold">Pharmacy — Patient Prescription</h1>
        <div className="text-sm text-muted-foreground">
          {(() => {
            const pName = (data?.patient?.name) || (list[0]?.patient?.name);
            const mr = (data?.patient?.mrNumber) || (list[0]?.patient?.mrNumber);
            if (pName) return <span className="mr-3">Patient: {pName}{mr ? ` (${mr})` : ''}</span>;
            return patientId ? <span className="mr-3">Patient ID: {patientId}</span> : null;
          })()}
          {(() => {
            const dName = (data?.doctor?.name) || (list[0]?.doctor?.name);
            if (dName) return <span>Doctor: {dName}</span>;
            return doctorId ? <span>Doctor ID: {doctorId}</span> : null;
          })()}
        </div>
      </div>

      {error && (
        <div className="text-red-600">{error}</div>
      )}

      {selectedId && data && (
        <Card>
          <CardHeader>
            <CardTitle>Referred Prescription Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <div></div>
              <Button variant="outline" size="sm" onClick={() => { setSelectedId(''); setData(null); }}>
                Back to list
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Patient</div>
                <div className="font-medium">{data.patient?.name || '-'}</div>
                <div className="text-sm text-muted-foreground">MR#: {data.patient?.mrNumber || '-'}</div>
                <div className="text-sm text-muted-foreground">Phone: {data.patient?.phone || '-'}</div>
                <div className="text-sm text-muted-foreground">Father Phone: {data.patient?.fatherPhone || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Doctor</div>
                <div className="font-medium">{data.doctor?.name || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div className="font-medium">{new Date(data.createdAt).toLocaleString()}</div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">Items</div>
              <ul className="list-disc pl-5">
                {data.items.map((it, idx) => (
                  <li key={idx}>{it.medicineName} — {it.dosage} — Qty: {it.quantity}</li>
                ))}
              </ul>
            </div>
            {data.notesEnglish && (
              <div>
                <div className="text-sm font-semibold mb-1">Notes</div>
                <div className="text-sm text-muted-foreground">{data.notesEnglish}</div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="default"
                onClick={() => {
                  try {
                    if (data) {
                      const payload = {
                        source: 'prescription',
                        prescriptionId: data._id,
                        items: (data.items || []).map(it => ({ name: it.medicineName, quantity: Number(it.quantity) || 1 })),
                        createdAt: Date.now()
                      };
                      localStorage.setItem('pos_prescription_import', JSON.stringify(payload));
                      try { window.dispatchEvent(new CustomEvent('pos:import-prescription')); } catch {}
                    }
                  } catch {}
                  (window as any).location.hash = '#/pharmacy';
                }}
              >
                Process Prescription
              </Button>
              <Button variant="outline" onClick={() => { (window as any).location.hash = '#/pharmacy'; }}>Back to Pharmacy</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedId && (
        <Card>
          <CardHeader>
            <CardTitle>Referred Prescriptions {loading ? '(Loading...)' : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 && !loading && (
              <div className="text-muted-foreground">No referred prescriptions found.</div>
            )}
            {/* Filters */}
            <div className="flex items-center justify-between pb-3 gap-2 flex-wrap">
              <input
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                placeholder="Search patient or doctor"
                className="border rounded px-3 py-2 text-sm w-full md:w-72"
              />
            </div>
            {list.length > 0 && (
              <div className="space-y-3">
                <div className="overflow-x-auto border rounded">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium cursor-pointer select-none" onClick={() => { setSortBy('patient'); setSortDir(d => (sortBy==='patient' && d==='asc')?'desc':'asc'); }}>Patient</th>
                        <th className="text-left px-3 py-2 font-medium">MR#</th>
                        <th className="text-left px-3 py-2 font-medium">Phone</th>
                        <th className="text-left px-3 py-2 font-medium">Father Phone</th>
                        <th className="text-left px-3 py-2 font-medium cursor-pointer select-none" onClick={() => { setSortBy('doctor'); setSortDir(d => (sortBy==='doctor' && d==='asc')?'desc':'asc'); }}>Doctor</th>
                        <th className="text-left px-3 py-2 font-medium cursor-pointer select-none" onClick={() => { setSortBy('createdAt'); setSortDir(d => (sortBy==='createdAt' && d==='asc')?'desc':'asc'); }}>Date/Time</th>
                        <th className="text-right px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((p) => {
                        const patientLabel = p.patient?.name || '-';
                        const mr = p.patient?.mrNumber || '-';
                        const ph = p.patient?.phone || '-';
                        const fph = p.patient?.fatherPhone || '-';
                        const doctorLabel = p.doctor?.name || '-';
                        const when = new Date(p.createdAt).toLocaleString();
                        return (
                          <tr key={p._id} className="border-t">
                            <td className="px-3 py-2">{patientLabel}</td>
                            <td className="px-3 py-2">{mr}</td>
                            <td className="px-3 py-2">{ph}</td>
                            <td className="px-3 py-2">{fph}</td>
                            <td className="px-3 py-2">{doctorLabel}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{when}</td>
                            <td className="px-3 py-2 text-right">
                              <Button size="sm" onClick={() => setSelectedId(p._id)}>Open</Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Pagination controls */}
                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={pageSize}
                      onChange={e => setPageSize(Number(e.target.value))}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                      <span className="text-sm px-2">Page {page} of {totalPages}</span>
                      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PatientPrescription;
