import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { API_URL } from '@/lib/api';

// Lightweight number formatter
const fmt = (n: any) => Number(n || 0).toLocaleString();

const CorporateDashboard: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [panels, setPanels] = React.useState<any[]>([]);
  const [rows, setRows] = React.useState<any[]>([]);
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');
  const [selectedPanels, setSelectedPanels] = React.useState<string[]>([]); // array of panelIds

  const fetchAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const headers = { Authorization: `Bearer ${token}` } as any;

      // Panels
      const pRes = await fetch(`${API_URL}/api/corporate/panels`, { headers });
      const pData = await pRes.json();
      const pList: any[] = Array.isArray(pData) ? pData : [];

      // Transactions (optional date filters + optional multi-panel)
      const qs = new URLSearchParams();
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      if (selectedPanels.length > 0) qs.set('panelId', selectedPanels.join(','));
      const tRes = await fetch(`${API_URL}/api/corporate/transactions${qs.toString() ? `?${qs}` : ''}`, { headers });
      const tData = await tRes.json();
      const tList: any[] = Array.isArray(tData) ? tData : [];

      setPanels(pList);
      setRows(tList);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedPanels]);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  // Aggregate per panel (respect selected panels)
  const perPanel = React.useMemo(() => {
    const map = new Map<string, any>();
    const byId = new Map<string, any>((panels || []).map((p: any) => [p._id, p]));

    const allowed = new Set<string>(selectedPanels.length ? selectedPanels : (panels || []).map((p:any)=>p._id));
    for (const p of panels || []) {
      if (!allowed.has(p._id)) continue;
      map.set(p._id, {
        panelId: p._id,
        panelName: p.name,
        creditLimit: Number(p.creditLimit || 0),
        openingBalance: Number(p.balance || 0),
        charges: 0,
        payments: 0,
        patients: new Set<string>(),
      });
    }

    for (const r of rows || []) {
      const pid = r.panelId;
      if (!pid) continue;
      if (selectedPanels.length && !allowed.has(String(pid))) continue;
      if (!map.has(pid)) {
        const p = byId.get(pid) || { _id: pid, name: pid };
        if (!allowed.has(String(pid))) continue;
        map.set(pid, {
          panelId: pid,
          panelName: p.name || pid,
          creditLimit: Number(p.creditLimit || 0),
          openingBalance: Number(p.balance || 0),
          charges: 0,
          payments: 0,
          patients: new Set<string>(),
        });
      }
      const rec = map.get(pid);
      const amt = Number(r.amount || 0);
      const type = String(r.type || '').toLowerCase();
      if (type === 'charge') rec.charges += amt;
      else if (type === 'payment') rec.payments += amt;
      if (r.patientId) rec.patients.add(String(r.patientId));
    }

    // Convert to array and compute balances
    const list = Array.from(map.values()).map((x: any) => {
      const currentBalance = Number(x.openingBalance || 0) + Number(x.charges || 0) - Number(x.payments || 0);
      const remainingCredit = Math.max(0, Number(x.creditLimit || 0) - currentBalance);
      return {
        ...x,
        patientCount: x.patients.size,
        currentBalance,
        remainingCredit,
      };
    });

    // Totals row
    const totals = list.reduce(
      (acc: any, it: any) => {
        acc.charges += it.charges;
        acc.payments += it.payments;
        acc.currentBalance += it.currentBalance;
        acc.patientCount += it.patientCount;
        return acc;
      },
      { charges: 0, payments: 0, currentBalance: 0, patientCount: 0 }
    );

    return { list, totals };
  }, [panels, rows]);

  return (
    <div className="p-4">
      <Card className="shadow">
        <CardHeader>
          <CardTitle>Corporate Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-600">From</label>
              <input type="date" className="w-full h-9 px-2 border rounded" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-600">To</label>
              <input type="date" className="w-full h-9 px-2 border rounded" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
            </div>
            {/* Multi-panel selector */}
            <div>
              <label className="text-xs text-slate-600">Panels</label>
              <div className="w-full h-9 px-2 border rounded flex items-center gap-2 overflow-x-auto">
                <label className="text-sm flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedPanels.length === 0}
                    onChange={(e)=> setSelectedPanels(e.target.checked ? [] : (panels||[]).map((p:any)=>p._id))}
                  />
                  All
                </label>
                {(panels || []).map((p:any)=> (
                  <label key={p._id} className="text-sm flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedPanels.includes(p._id)}
                      onChange={(e)=> setSelectedPanels(prev => {
                        const set = new Set(prev);
                        if (e.target.checked) set.add(p._id); else set.delete(p._id);
                        return Array.from(set);
                      })}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchAll} disabled={loading}>Refresh</Button>
              <Button variant="outline" onClick={()=>{ setDateFrom(''); setDateTo(''); }}>Clear</Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <MiniStat title="Total Charges" value={`Rs. ${fmt(perPanel.totals.charges)}`} />
            <MiniStat title="Total Payments" value={`Rs. ${fmt(perPanel.totals.payments)}`} />
            <MiniStat title="Current Balance" value={`Rs. ${fmt(perPanel.totals.currentBalance)}`} />
            <MiniStat title="Patients (unique)" value={fmt(perPanel.totals.patientCount)} />
          </div>

          {/* Per Panel Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Panel</th>
                  <th className="py-2 pr-4">Credit Limit</th>
                  <th className="py-2 pr-4">Opening Balance</th>
                  <th className="py-2 pr-4">Charges</th>
                  <th className="py-2 pr-4">Payments</th>
                  <th className="py-2 pr-4">Current Balance</th>
                  <th className="py-2 pr-4">Remaining Credit</th>
                  <th className="py-2 pr-4">Patients</th>
                </tr>
              </thead>
              <tbody>
                {perPanel.list.map((r: any) => (
                  <tr key={r.panelId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.panelName}</td>
                    <td className="py-2 pr-4">{fmt(r.creditLimit)}</td>
                    <td className="py-2 pr-4">{fmt(r.openingBalance)}</td>
                    <td className="py-2 pr-4">{fmt(r.charges)}</td>
                    <td className="py-2 pr-4">{fmt(r.payments)}</td>
                    <td className="py-2 pr-4">{fmt(r.currentBalance)}</td>
                    <td className="py-2 pr-4">{fmt(r.remainingCredit)}</td>
                    <td className="py-2 pr-4">{fmt(r.patientCount)}</td>
                  </tr>
                ))}
                {perPanel.list.length === 0 && (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={8}>No data for selected range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MiniStat = ({ title, value }: { title: string; value: React.ReactNode }) => (
  <div className="p-3 rounded border bg-white">
    <div className="text-xs text-gray-500">{title}</div>
    <div className="text-xl font-semibold">{value}</div>
  </div>
);

export default CorporateDashboard;
