import React from 'react';
import { SalesWidget } from '@/components/dashboard/SalesWidget';
import { InventoryWidget } from '@/components/dashboard/InventoryWidget';
import { ProfitWidget } from '@/components/dashboard/ProfitWidget';

export function DashboardPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <SalesWidget />
      <InventoryWidget />
      <ProfitWidget />
    </div>
  );
}
