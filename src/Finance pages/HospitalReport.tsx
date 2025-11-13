import React from 'react';
import Reports from '@/components/Reports';

export default function HospitalReport() {
  // Render the full Hospital Reports UI inside the Finance portal
  // We use edge-to-edge container here; Finance layout will make it full width for this route
  return (
    <div className="w-full">
      <Reports />
    </div>
  );
}
