import React from 'react';
import { useCorporatePanels } from '@/hooks/useApi';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { API_URL } from '@/lib/api';

const PanelsPage: React.FC = () => {
  const { data: panels = [], refetch, isFetching } = useCorporatePanels();
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState<null | any>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', contact: '', creditLimit: '', balance: '', notes: '' });
  const [payOpen, setPayOpen] = React.useState<null | any>(null);
  const [payForm, setPayForm] = React.useState({ panelId: '', amount: '', description: '' });

  const resetForm = () => setForm({ name: '', contact: '', creditLimit: '', balance: '', notes: '' });

  const startCreate = () => { resetForm(); setOpenCreate(true); };
  const startEdit = (p: any) => {
    setForm({
      name: p.name || '',
      contact: p.contact || '',
      creditLimit: String(p.creditLimit ?? ''),
      balance: String(p.balance ?? ''),
      notes: p.notes || ''
    });
    setOpenEdit(p);
  };

  const startPayment = (p: any) => {
    setPayForm({ panelId: p?._id || '', amount: '', description: '' });
    setPayOpen(p);
  };

  const submitCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token') || '';
      await fetch(`${API_URL}/api/corporate/panels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          contact: form.contact.trim() || undefined,
          creditLimit: Number(form.creditLimit || 0),
          balance: form.balance === '' ? undefined : Number(form.balance),
          notes: form.notes.trim() || undefined,
        }),
      });
      setOpenCreate(false);
      resetForm();
      await refetch();
    } finally { setSaving(false); }
  };

  const submitEdit = async () => {
    if (!openEdit) return;
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('token') || '';
      await fetch(`${API_URL}/api/corporate/panels/${openEdit._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          contact: form.contact.trim() || undefined,
          creditLimit: Number(form.creditLimit || 0),
          balance: form.balance === '' ? undefined : Number(form.balance),
          notes: form.notes.trim() || undefined,
        }),
      });
      setOpenEdit(null);
      resetForm();
      await refetch();
    } finally { setSaving(false); }
  };

  const submitDelete = async (p: any) => {
    if (!p?._id) return;
    if (!confirm(`Delete panel "${p.name}"? This cannot be undone.`)) return;
    const token = localStorage.getItem('token') || '';
    await fetch(`${API_URL}/api/corporate/panels/${p._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await refetch();
  };

  return (
    <div className="p-4">
      <Card className="shadow">
        <CardHeader>
          <CardTitle>Corporate Panels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">Manage panels used for credit billing.</div>
            <div className="flex items-center gap-2">
              <Button onClick={startCreate}>Add Panel</Button>
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Credit Limit</th>
                  <th className="py-2 pr-4">Balance</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(panels) ? panels : []).map((p: any) => (
                  <tr key={p._id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{p.name}</td>
                    <td className="py-2 pr-4">{p.contact || '-'}</td>
                    <td className="py-2 pr-4">{Number(p.creditLimit || 0).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(p.balance || 0).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <Button onClick={() => startPayment(p)}>Add Payment</Button>
                        <Button variant="outline" onClick={() => startEdit(p)}>Edit</Button>
                        <Button variant="destructive" onClick={() => submitDelete(p)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!panels || panels.length === 0) && (
                  <tr>
                    <td className="py-4 text-gray-500" colSpan={5}>No panels found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {(openCreate || openEdit) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-4">
            <div className="text-lg font-semibold mb-2">{openCreate ? 'Add Panel' : 'Edit Panel'}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-600">Name</label>
                <input className="w-full h-9 px-3 border rounded" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-600">Contact</label>
                <input className="w-full h-9 px-3 border rounded" value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-slate-600">Credit Limit</label>
                <input className="w-full h-9 px-3 border rounded" value={form.creditLimit} onChange={e=>setForm({...form,creditLimit:e.target.value})} />
              </div>
              <div>
                <label className="text-xs text-slate-600">Balance</label>
                <input className="w-full h-9 px-3 border rounded" value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-600">Notes</label>
                <textarea className="w-full px-3 py-2 border rounded" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={()=>{ setOpenCreate(false); setOpenEdit(null); }}>Cancel</Button>
              <Button onClick={openCreate ? submitCreate : submitEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {payOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-4">
            <div className="text-lg font-semibold mb-2">Add Payment - {payOpen?.name}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-slate-600">Panel</label>
                <select className="w-full h-9 px-2 border rounded" value={payForm.panelId} onChange={e=>setPayForm({...payForm,panelId:e.target.value})}>
                  {(Array.isArray(panels) ? panels : []).map((p: any) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600">Amount</label>
                <input className="w-full h-9 px-3 border rounded" value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-600">Description</label>
                <input className="w-full h-9 px-3 border rounded" value={payForm.description} onChange={e=>setPayForm({...payForm,description:e.target.value})} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={()=>setPayOpen(null)}>Cancel</Button>
              <Button onClick={async ()=>{
                const token = localStorage.getItem('token') || '';
                await fetch(`${API_URL}/api/corporate/transactions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ type: 'payment', panelId: payForm.panelId, amount: Number(payForm.amount || 0), description: payForm.description || undefined })
                });
                setPayOpen(null);
                setPayForm({ panelId: '', amount: '', description: '' });
                await refetch();
              }}>Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanelsPage;
