import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useIpdContext } from '@/pages/Ipd';
import { useDischargeAdmission } from '@/hooks/useIpdApi';
import { Bed, IpdAdmission, Ward, useFloors, useRooms, useWards } from '@/hooks/useIpdApi';
import { useToast } from '../ui/use-toast';
import BedCard from './BedCard';
import { Button } from '@/components/ui/button';
import { Plus, BedDouble } from 'lucide-react';
import AddBedButtonWithForm from './AddBedButtonWithForm';
import PatientDetailModal from './PatientDetailModal';
import AddFloorDialog from './AddFloorDialog';
import AddRoomDialog from './AddRoomDialog';
import AddWardDialog from './AddWardDialog';
import ManageRoomsDialog from './ManageRoomsDialog';
import ManageWardsDialog from './ManageWardsDialog';

export const BedPlan: React.FC = () => {
  const { admissions, beds, isFetchingBeds, handleBedSelect, handleBedEdit, handleBedDelete, setShowAdmissionModal } = useIpdContext();
  const { toast } = useToast();
  const navigate = useNavigate();

  const dischargeMutation = useDischargeAdmission();



  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);

  const admissionMap = useMemo(() =>
    admissions.reduce((acc, admission) => {
      if (admission.status === 'Admitted' && admission.bedId) {
        const bedKey = typeof (admission as any).bedId === 'object'
          ? (admission as any).bedId._id
          : (admission as any).bedId;
        if (bedKey) {
          acc[bedKey] = admission;
        }
      }
      return acc;
    }, {} as Record<string, IpdAdmission>)
  , [admissions]);

  // Data for hierarchy filters
  const { data: floors = [] } = useFloors();
  const [floorFilter, setFloorFilter] = useState<string>('All');
  const { data: rooms = [] } = useRooms(floorFilter === 'All' ? undefined : floorFilter);
  const { data: wards = [] } = useWards();

  const [roomFilter, setRoomFilter] = useState<string>('All');

  const groupedBeds = useMemo(() => {
    const groups: Record<string, Bed[]> = {};
    beds.forEach(bed => {
      // Extract ward or room data
      const wardObj: any = typeof (bed as any).wardId === 'object' ? (bed as any).wardId : null;
      const roomObj: any = typeof (bed as any).roomId === 'object' ? (bed as any).roomId : null;
      
      let groupName: string;
      let matchesFloor = true;
      let matchesRoom = true;

      if (wardObj) {
        // Bed belongs to a ward
        groupName = wardObj.name || 'Unassigned Ward';
        matchesFloor = floorFilter === 'All' || wardObj.floor === floorFilter;
        matchesRoom = roomFilter === 'All' || (wardObj.roomId && (typeof wardObj.roomId === 'string' ? wardObj.roomId === roomFilter : wardObj.roomId?._id === roomFilter));
      } else if (roomObj) {
        // Bed belongs directly to a room
        groupName = `${roomObj.name} (Room)`;
        matchesFloor = floorFilter === 'All' || roomObj.floorId === floorFilter;
        matchesRoom = roomFilter === 'All' || roomObj._id === roomFilter;
      } else {
        // Fallback for beds without ward or room
        groupName = 'Unassigned';
        matchesFloor = floorFilter === 'All';
        matchesRoom = roomFilter === 'All';
      }

      if (!(matchesFloor && matchesRoom)) return;

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(bed);
    });
    return Object.entries(groups).map(([wardName, beds]) => ({ wardName, beds }));
  }, [beds, floorFilter, roomFilter]);

  // Filters: ward and status
  const wardOptions = useMemo(() => ['All', ...groupedBeds.map(g => g.wardName)], [groupedBeds]);
  const [wardFilter, setWardFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | Bed['status']>('All');

  const filteredGroups = useMemo(() => {
    return groupedBeds
      .filter(g => (wardFilter === 'All' ? true : g.wardName === wardFilter))
      .map(g => ({
        wardName: g.wardName,
        beds: g.beds
          .filter(b => (statusFilter === 'All' ? true : b.status === statusFilter))
          .sort((a, b) => (Number(a.bedNumber) || 0) - (Number(b.bedNumber) || 0))
      }))
      .filter(g => g.beds.length > 0);
  }, [groupedBeds, wardFilter, statusFilter]);

  const handleBedClick = (bed: Bed) => {
    // If the bed has an active admission, navigate to the patient's profile
    const admission = admissionMap[bed._id];
    if (admission && admission.status === 'Admitted') {
      const maybePatient: any = admission.patientId as any;
      const patientId = typeof maybePatient === 'string' ? maybePatient : maybePatient?._id;
      if (patientId) {
        navigate(`/ipd/patients/${patientId}`);
        return;
      }
      // Fallback: admission exists but patientId missing
      toast({ title: 'Patient not found', description: 'Cannot open profile because patient ID is missing.', variant: 'destructive' });
      return;
    }

    // No active admission for this bed
    toast({ title: 'Bed not occupied', description: 'This bed is currently not occupied.' });
  };

  const handleDischarge = (admissionId: string) => {
    dischargeMutation.mutate(admissionId, {
      onSuccess: () => {
        toast({ title: 'Success', description: 'Patient discharged successfully.' });
        setSelectedBed(null);
      },
      onError: (error: any) => {
        toast({ title: 'Error', description: `Failed to discharge patient: ${error.message}`, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="relative mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <BedDouble className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Bed Management</h1>
            <p className="text-sm text-muted-foreground">Assign, track, and manage in-patient beds</p>
          </div>
        </div>
        {/* Absolutely positioned actions on header's top-right */}
        <div className="absolute right-0 top-0 flex gap-2">
          <AddFloorDialog />
          <AddRoomDialog />
          <AddWardDialog
            triggerLabel="Add Ward"
            defaultFloorId={floorFilter === 'All' ? undefined : floorFilter}
          />
          <ManageRoomsDialog />
          <ManageWardsDialog />
          <AddBedButtonWithForm />
        </div>
      </div>

      {/* Empty state */}
      {groupedBeds.length === 0 && !isFetchingBeds && (
        <div className="text-center text-muted-foreground py-16 border rounded-md bg-white">
          <div className="mb-4">No beds found. Use "Add Bed" to create one.</div>
          <div className="flex justify-center"><AddBedButtonWithForm /></div>
        </div>
      )}
      {groupedBeds.length === 0 && isFetchingBeds && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg border-2 aspect-square bg-white">
              <div className="w-8 h-8 mb-2 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}
      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Floor</label>
          <select className="border rounded px-2 py-1 bg-white" value={floorFilter} onChange={(e) => { setFloorFilter(e.target.value); setRoomFilter('All'); setWardFilter('All'); }}>
            <option value="All">All</option>
            {floors.map(f => (<option key={f._id} value={f._id}>{f.name}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Room</label>
          <select className="border rounded px-2 py-1 bg-white" value={roomFilter} onChange={(e) => { setRoomFilter(e.target.value); setWardFilter('All'); }}>
            <option value="All">All</option>
            {rooms.map(r => (<option key={r._id} value={r._id}>{r.name}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Ward</label>
          <select className="border rounded px-2 py-1 bg-white" value={wardFilter} onChange={(e) => setWardFilter(e.target.value)}>
            {wardOptions.map(w => (<option key={w} value={w}>{w}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Status</label>
          <select className="border rounded px-2 py-1 bg-white" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="All">All</option>
            <option value="Available">Available</option>
            <option value="Occupied">Occupied</option>
            <option value="Cleaning">Cleaning</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Isolation">Isolation</option>
          </select>
        </div>
      </div>

      {filteredGroups.map(({ wardName, beds: wardBeds }) => (
        <div key={wardName} className="mb-8">
          <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-700">{wardName}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {wardBeds.map(bed => (
              <BedCard 
                key={bed._id} 
                bed={bed} 
                admission={admissionMap[bed._id]} 
                onClick={() => handleBedClick(bed)}
                onActionClick={() => setSelectedBed(bed)}
                onDelete={(b) => handleBedDelete(b)}
              />
            ))}
          </div>
        </div>
      ))}

      {selectedBed && (
        <PatientDetailModal
          open={!!selectedBed}
          bed={selectedBed}
          admission={selectedBed ? admissionMap[selectedBed._id] : undefined}
          onClose={() => setSelectedBed(null)}
          onDischarge={handleDischarge}
          onEdit={handleBedEdit}
          onDelete={handleBedDelete}
        />
      )}
    </div>
  );
};


