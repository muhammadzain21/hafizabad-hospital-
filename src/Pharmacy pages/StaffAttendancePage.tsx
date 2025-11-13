import React from 'react';
import StaffAttendance from '@/components/StaffAttendance';

export function StaffAttendancePage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Staff Attendance</h1>
      <StaffAttendance />
    </div>
  );
}
