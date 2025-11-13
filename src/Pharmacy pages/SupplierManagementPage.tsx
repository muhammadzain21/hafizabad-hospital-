import React from 'react';
import { SupplierList } from '@/components/suppliers/SupplierList';
import { mockSuppliers } from '@/data/mockSuppliers';
import { Supplier } from '@/types/supplier';

export function SupplierManagementPage() {
  const [suppliers, setSuppliers] = React.useState<Supplier[]>(mockSuppliers);
  
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Supplier Management</h1>
      <SupplierList 
        suppliers={suppliers} 
        onSupplierUpdate={(updatedSupplier) => {
          setSuppliers(prev => 
            prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s)
          );
        }}
      />
    </div>
  );
}
