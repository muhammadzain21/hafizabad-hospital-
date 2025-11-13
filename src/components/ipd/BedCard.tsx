import React from 'react';
import { BedDouble, MoreVertical } from 'lucide-react';
import { Bed, IpdAdmission } from '@/hooks/useIpdApi';

const statusStyles: Record<Bed['status'], string> = {
  Available: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 hover:shadow-lg',
  Occupied: 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100 hover:border-rose-400 hover:shadow-lg',
  Cleaning: 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100 hover:border-sky-400 hover:shadow-lg',
  Maintenance: 'bg-yellow-50 border-yellow-200 text-yellow-800 hover:bg-yellow-100 hover:border-yellow-400 hover:shadow-lg',
  Isolation: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100 hover:border-purple-400 hover:shadow-lg',
};

interface BedCardProps {
  bed: Bed;
  admission?: IpdAdmission;
  onClick?: (bed: Bed) => void;
  onActionClick?: (bed: Bed) => void; // opens actions dialog
  onDelete?: (bed: Bed) => void; // triggers delete
}

const PatientName = ({ admission }: { admission?: IpdAdmission }) => {
  if (!admission) return null;
  // Prefer populated patient object from lightweight admissions
  const maybeObj: any = admission.patientId as any;
  const name = typeof maybeObj === 'object' ? (maybeObj.name || maybeObj.fullName) : admission.patientName;
  return <>{name || 'Patient'}</>;
};

const BedCard: React.FC<BedCardProps> = ({ bed, admission, onClick, onActionClick, onDelete }) => {
  const cardClasses = `
    relative p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 
    flex flex-col items-center justify-center aspect-square 
    ${statusStyles[bed.status] || statusStyles.Maintenance}
  `;

  const iconClasses = `
    w-8 h-8 mb-2 
    ${bed.status === 'Available' ? 'text-emerald-500' : 
       bed.status === 'Occupied' ? 'text-rose-500' : 
       bed.status === 'Cleaning' ? 'text-sky-500' : 
       bed.status === 'Isolation' ? 'text-purple-500' : 'text-yellow-500'}
  `;

  return (
    <div onClick={() => onClick?.(bed)} className={cardClasses}>
      {/* Actions button */}
      <button
        type="button"
        className="absolute top-2 right-2 p-1 rounded hover:bg-black/5"
        onClick={(e) => { e.stopPropagation(); onActionClick?.(bed); }}
        aria-label="Bed actions"
        title="Bed actions"
      >
        <MoreVertical className="w-4 h-4 opacity-70" />
      </button>
      <BedDouble className={iconClasses} />
      <span className="font-bold text-lg tracking-wider">{bed.bedNumber}</span>
      {bed.status === 'Occupied' && admission ? (
        <>
          <span className="text-xs font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full mb-1 animate-pulse-slow">Occupied</span>
          <div className="font-semibold text-sm text-gray-700 truncate" title={admission.patientName}>
            <PatientName admission={admission} />
          </div>
        </>
      ) : (
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Available</span>
      )}

      {/* Inline Edit/Delete controls */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-2">
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border bg-white/70 hover:bg-white text-gray-700"
          onClick={(e) => { e.stopPropagation(); onActionClick?.(bed); }}
        >
          Edit
        </button>
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border bg-red-50 hover:bg-red-100 text-red-700"
          onClick={(e) => {
            e.stopPropagation();
            if (onDelete && window.confirm('Delete this bed? This cannot be undone.')) onDelete(bed);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default BedCard;
