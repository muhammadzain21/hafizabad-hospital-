import React from 'react';

const items: { label: string; color: string }[] = [
  { label: 'Available', color: 'bg-green-500' },
  { label: 'Occupied', color: 'bg-red-500' },
  { label: 'Cleaning', color: 'bg-blue-500' },
  { label: 'Maintenance', color: 'bg-yellow-500' },
];

const Legend: React.FC = () => (
  <div className="flex items-center gap-4 mb-4 text-sm">
    {items.map((i) => (
      <div key={i.label} className="flex items-center gap-1">
        <span className={`inline-block w-3 h-3 rounded-full ${i.color}`}></span>
        {i.label}
      </div>
    ))}
  </div>
);

export default Legend;
