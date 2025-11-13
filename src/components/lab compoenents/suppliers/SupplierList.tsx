import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SupplierForm, { SupplierPayload } from "./SupplierForm";
import SupplierDetail from "./SupplierDetail";

export interface Supplier extends SupplierPayload { _id: string; createdAt?: string; updatedAt?: string }

interface Props {
  onView: (supplier: Supplier) => void;
}

const SupplierList: React.FC<Props> = ({ onView }) => {
  const [list, setList] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [viewing, setViewing] = useState<Supplier | null>(null);

  const token = localStorage.getItem("token");

  const load = async () => {
    const res = await fetch("/api/lab/suppliers", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return setList([]);
    const data = await res.json();
    setList(data);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [list, search]);

  const createSupplier = async (payload: SupplierPayload) => {
    await fetch("/api/lab/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    setCreating(false);
    await load();
  };

  const saveSupplier = async (payload: SupplierPayload) => {
    if (!editing) return;
    await fetch(`/api/lab/suppliers/${editing._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    setEditing(null);
    await load();
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    await fetch(`/api/lab/suppliers/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await load();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Search supplier" value={search} onChange={e=> setSearch(e.target.value)} className="max-w-sm" />
        <Button onClick={()=> setCreating(true)}>+ New Supplier</Button>
      </div>
      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Supplier</DialogTitle>
          </DialogHeader>
          <SupplierForm onCancel={()=> setCreating(false)} onSave={createSupplier} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o)=> { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          {editing && (
            <SupplierForm initial={editing} onCancel={()=> setEditing(null)} onSave={saveSupplier} />
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={(o)=> { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier Details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <SupplierDetail supplierId={viewing._id} onBack={()=> setViewing(null)} />
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {filtered.map(s => (
          <Card key={s._id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-muted-foreground">{s.phone || ""} {s.email ? `· ${s.email}` : ""}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={()=> setViewing(s)}>View</Button>
                <Button variant="outline" onClick={()=> setEditing(s)}>Edit</Button>
                <Button variant="destructive" onClick={()=> deleteSupplier(s._id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground p-4">No suppliers found.</div>
        )}
      </div>
    </div>
  );
};

export default SupplierList;
