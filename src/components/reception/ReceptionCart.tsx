import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

const ReceptionCart: React.FC = () => {
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [items, setItems] = useState<CartItem[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftPrice, setDraftPrice] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const [discountPct, setDiscountPct] = useState<string>('0');

  const addItem = () => {
    const name = draftName.trim();
    const price = parseFloat(draftPrice);
    const qty = Math.max(1, parseInt(draftQty || '1', 10));
    if (!name || !isFinite(price)) return;
    setItems(prev => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, name, price, qty }]);
    setDraftName('');
    setDraftPrice('');
    setDraftQty('1');
  };

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const updateQty = (id: string, q: number) => setItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, q) } : i));

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const pct = Math.max(0, Math.min(100, parseFloat(discountPct || '0')));
    const discount = subtotal * (isFinite(pct) ? pct/100 : 0);
    const total = subtotal - discount;
    return { subtotal, discount, total };
  }, [items, discountPct]);

  const printTicket = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const rows = items.map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${i.price.toFixed(2)}</td><td style="text-align:right">${(i.qty*i.price).toFixed(2)}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Reception Ticket</title>
      <style>body{font-family: Arial; padding:12px} table{width:100%; border-collapse:collapse} th,td{padding:6px;border-bottom:1px solid #eee} th{text-align:left;background:#f8fafc} .right{text-align:right}</style>
    </head><body>
      <h3 style="margin:0 0 8px">Reception Ticket</h3>
      <div style="font-size:12px; color:#555">Patient: ${patientName || 'Walk-in'} • ${patientPhone || ''}</div>
      <table style="margin-top:10px"><thead><tr><th>Service</th><th style="text-align:center">Qty</th><th class="right">Price</th><th class="right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:10px; text-align:right">Subtotal: <strong>${totals.subtotal.toFixed(2)}</strong></div>
      <div style="text-align:right">Discount: <strong>${totals.discount.toFixed(2)}</strong></div>
      <div style="text-align:right; font-size:18px">Total: <strong>${totals.total.toFixed(2)}</strong></div>
      <script>window.addEventListener('load',()=>{window.print(); setTimeout(()=>window.close(), 300);});</script>
    </body></html>`;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Reception Cart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Patient Name</Label>
              <Input value={patientName} onChange={(e)=>setPatientName(e.target.value)} placeholder="Enter patient name" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={patientPhone} onChange={(e)=>setPatientPhone(e.target.value)} placeholder="03xxxxxxxxx" />
            </div>
            <div>
              <Label>Discount (%)</Label>
              <Input type="number" min={0} max={100} value={discountPct} onChange={(e)=>setDiscountPct(e.target.value)} />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Service / Item</Label>
              <Input value={draftName} onChange={(e)=>setDraftName(e.target.value)} placeholder="e.g. OPD Consultation" />
            </div>
            <div>
              <Label>Price</Label>
              <Input type="number" min="0" step="0.01" value={draftPrice} onChange={(e)=>setDraftPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Qty</Label>
              <Input type="number" min="1" value={draftQty} onChange={(e)=>setDraftQty(e.target.value)} />
            </div>
            <div>
              <Button onClick={addItem} className="w-full">Add</Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Service</th>
                    <th className="text-center p-2">Qty</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">Amount</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id} className="border-t">
                      <td className="p-2">{i.name}</td>
                      <td className="p-2 text-center">
                        <input type="number" min={1} value={i.qty} onChange={(e)=>updateQty(i.id, parseInt(e.target.value||'1',10))} className="w-16 text-center border rounded"/>
                      </td>
                      <td className="p-2 text-right">{i.price.toFixed(2)}</td>
                      <td className="p-2 text-right">{(i.qty*i.price).toFixed(2)}</td>
                      <td className="p-2 text-right">
                        <Button variant="outline" onClick={()=>removeItem(i.id)}>Remove</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <div className="w-full md:w-80 space-y-2">
              <div className="flex justify-between"><span>Subtotal</span><span>{totals.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>{totals.discount.toFixed(2)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{totals.total.toFixed(2)}</span></div>
              <Button className="w-full" disabled={items.length===0} onClick={printTicket}>Print Ticket</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceptionCart;
