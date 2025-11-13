import React from 'react';
import { POSInterface } from '@/components/pos/POSInterface';
import { Cart } from '@/components/pos/Cart';

export function POSPage() {
  return (
    <div className="flex h-screen">
      <div className="flex-1 p-4">
        <POSInterface />
      </div>
      <div className="w-96 border-l p-4">
        <Cart />
      </div>
    </div>
  );
}
