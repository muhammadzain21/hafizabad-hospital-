import React from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCorporatePanels } from '@/hooks/useApi';
import { API_URL } from '@/lib/api';

const TransactionsPage: React.FC = () => {
  const { data: panels = [] } = useCorporatePanels();
  const [panelId, setPanelId] = React.useState<string>('');
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(20);
  const [total, setTotal] = React.useState<number | null>(null);

  const fetchTxns = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const params = new URLSearchParams();
      if (panelId) params.set('panelId', panelId);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_URL}/api/corporate/transactions${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const baseRows: any[] = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
      const totalFromApi: any = !Array.isArray(data) ? (data?.total ?? null) : null;

      // Enrich rows with patient/token details if only IDs are present
      const tokenIds = Array.from(new Set(baseRows.map((r: any) => r.tokenId).filter(Boolean)));
      const patientIds = Array.from(new Set(baseRows.map((r: any) => r.patientId).filter(Boolean)));

      const headers = { Authorization: `Bearer ${token}` } as any;
      const tokenMap = new Map<string, any>();
      const patientMap = new Map<string, any>();

      // Fetch tokens in parallel
      await Promise.all(
        tokenIds.map(async (id: string) => {
          try {
            const tr = await fetch(`${API_URL}/api/tokens/${id}`, { headers });
            const tj = await tr.json();
            if (tj) tokenMap.set(id, tj);
          } catch {}
        })
      );

      // Fetch patients in parallel (skip if already derivable from token)
      await Promise.all(
        patientIds.map(async (id: string) => {
          try {
            const alreadyViaToken = Array.from(tokenMap.values()).some((t: any) => (t?.patientId || t?.patient?._id) === id);
            if (alreadyViaToken) return;
            const pr = await fetch(`${API_URL}/api/patients/${id}`, { headers });
            const pj = await pr.json();
            if (pj) patientMap.set(id, pj);
          } catch {}
        })
      );

      const enriched = baseRows.map((r: any) => {
        const t = r.tokenId ? tokenMap.get(r.tokenId) : null;
        const p = t?.patient || (r.patientId ? patientMap.get(r.patientId) : null);
        const name = r.patientName || t?.patientName || p?.patientName || p?.name;
        const father = r.guardianName || r.fatherName || p?.guardianName || p?.fatherName;
        const cnic = r.cnic || p?.cnic;
        const mr = r.mrNumber || t?.mrNumber || p?.mrNumber || p?.mr || p?.mrn;
        const tokenNumber = r.tokenNumber || t?.tokenNumber || t?.number || r.tokenNo;
        return { ...r, patientName: name, guardianName: father, cnic, mrNumber: mr, tokenNumber };
      });

      setRows(enriched);
      setTotal(typeof totalFromApi === 'number' ? totalFromApi : (Array.isArray(enriched) ? (enriched.length < limit && page === 1 ? enriched.length : null) : null));
    } catch (e) {
      setRows([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [panelId, page, limit]);

  React.useEffect(() => { fetchTxns(); }, [fetchTxns]);

  const canPrev = page > 1;
  const canNext = total != null ? (page * limit) < total : rows.length === limit; 

  const handleDownloadPdf = () => {
    const panelName = panelId ? ((panels as any[]).find((p:any)=>p._id===panelId)?.name || panelId) : 'All Panels';
    const title = `Corporate Transactions - ${panelName}`;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(14);
    doc.text(title, 40, 30);
    const head = [[
      'Date','Panel','Type','Amount','Department','Patient','Father Name','CNIC','MR Number','Token','Description'
    ]];
    const body = rows.map(r => [
      r.date ? new Date(r.date).toLocaleString() : '-',
      r.panelName || r.panelId || '-',
      r.type || '-',
      String(Number(r.amount || 0).toLocaleString()),
      r.department || '-',
      r.patientName || '-',
      r.guardianName || '-',
      r.cnic || '-',
      r.mrNumber || '-',
      r.tokenNumber || '-',
      r.description || '-',
    ]);
    (autoTable as any)(doc, {
      head,
      body,
      startY: 50,
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [40, 53, 147] },
      columnStyles: { 10: { cellWidth: 180 } },
    });
    const file = `Corporate-Transactions-${panelName.replace(/[^a-z0-9]/gi,'_')}.pdf`;
    doc.save(file);
  };

  return (
    <div className="p-4">
      <Card className="shadow">
        <CardHeader>
          <CardTitle>Corporate Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <select
              className="border rounded-md h-9 px-2"
              value={panelId}
              onChange={(e) => setPanelId(e.target.value)}
            >
              <option value="">All Panels</option>
              {(Array.isArray(panels) ? panels : []).map((p: any) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <Button variant="outline" onClick={fetchTxns} disabled={loading}>Refresh</Button>
            <Button variant="outline" onClick={handleDownloadPdf}>Download PDF</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Panel</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Patient</th>
                  <th className="py-2 pr-4">Father Name</th>
                  <th className="py-2 pr-4">CNIC</th>
                  <th className="py-2 pr-4">MR Number</th>
                  <th className="py-2 pr-4">Token</th>
                  <th className="py-2 pr-4">Description</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r._id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.date ? new Date(r.date).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-4">{r.panelName || r.panelId || '-'}</td>
                    <td className="py-2 pr-4 capitalize">{r.type}</td>
                    <td className="py-2 pr-4">{Number(r.amount || 0).toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.department || '-'}</td>
                    <td className="py-2 pr-4">{r.patientName || r.patient?.patientName || r.patient?.name || r.name || '-'}</td>
                    <td className="py-2 pr-4">{r.guardianName || r.fatherName || r.patient?.guardianName || r.patient?.fatherName || '-'}</td>
                    <td className="py-2 pr-4">{r.cnic || r.patient?.cnic || '-'}</td>
                    <td className="py-2 pr-4">{r.mrNumber || r.patient?.mrNumber || r.patient?.mr || r.mr || '-'}</td>
                    <td className="py-2 pr-4">{r.tokenNumber || r.token?.tokenNumber || r.token?.number || r.tokenNo || '-'}</td>
                    <td className="py-2 pr-4">{r.description || '-'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={11}>No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Rows per page</span>
                <select className="border rounded h-8 px-2" value={limit} onChange={e=>{ setPage(1); setLimit(parseInt(e.target.value)||20); }}>
                  {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={!canPrev || loading} onClick={()=> setPage(p => Math.max(1, p-1))}>Prev</Button>
                <div className="text-sm">Page {page}{total!=null ? ` of ${Math.max(1, Math.ceil(total/limit))}` : ''}</div>
                <Button variant="outline" disabled={!canNext || loading} onClick={()=> setPage(p => p+1)}>Next</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsPage;
