import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DoctorAppointments from '@/components/doctor/DoctorAppointments';
import DoctorTokens from '@/components/doctor/DoctorTokens';
import DoctorRevenue from '@/components/doctor/DoctorRevenue';
import DoctorPrescription from '@/components/doctor/DoctorPrescription';
import PatientHistory from '@/components/PatientHistory';

const DoctorPage: React.FC = () => {
  const [tab, setTab] = useState('appointments');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 font-poppins pl-64">
      <Tabs value={tab} onValueChange={setTab} className="w-full flex">
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 w-64 bg-white text-gray-900 flex flex-col shadow-lg z-50">
          <div className="flex items-center gap-2 px-6 py-6 text-xl font-bold border-b border-indigo-800 mb-4">
            🩺 Doctor Portal
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-0">
            <TabsList className="flex flex-col w-full bg-transparent space-y-2">
              <TabsTrigger value="appointments" className="flex items-center gap-3 pl-6 pr-4 py-3 w-full text-left rounded-lg transition-all hover:bg-indigo-50 hover:text-indigo-700 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 data-[state=active]:font-medium data-[state=active]:border-l-4 data-[state=active]:border-indigo-500">
                📅 Today Appointments
              </TabsTrigger>
              <TabsTrigger value="tokens" className="flex items-center gap-3 pl-6 pr-4 py-3 w-full text-left rounded-lg transition-all hover:bg-indigo-50 hover:text-indigo-700 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 data-[state=active]:font-medium data-[state=active]:border-l-4 data-[state=active]:border-indigo-500">
                🎟️ Tokens Today
              </TabsTrigger>
              <TabsTrigger value="revenue" className="flex items-center gap-3 pl-6 pr-4 py-3 w-full text-left rounded-lg transition-all hover:bg-indigo-50 hover:text-indigo-700 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 data-[state=active]:font-medium data-[state=active]:border-l-4 data-[state=active]:border-indigo-500">
                💰 Revenue & Commission
              </TabsTrigger>
              <TabsTrigger value="prescription" className="flex items-center gap-3 pl-6 pr-4 py-3 w-full text-left rounded-lg transition-all hover:bg-indigo-50 hover:text-indigo-700 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 data-[state=active]:font-medium data-[state=active]:border-l-4 data-[state=active]:border-indigo-500">
                💊 Create Prescription
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-3 pl-6 pr-4 py-3 w-full text-left rounded-lg transition-all hover:bg-indigo-50 hover:text-indigo-700 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 data-[state=active]:font-medium data-[state=active]:border-l-4 data-[state=active]:border-indigo-500">
                📂 Patient History
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 ml-64 p-6">
          <TabsContent value="appointments"><DoctorAppointments /></TabsContent>
          <TabsContent value="tokens"><DoctorTokens /></TabsContent>
          <TabsContent value="revenue"><DoctorRevenue /></TabsContent>
          <TabsContent value="prescription"><DoctorPrescription /></TabsContent>
          <TabsContent value="history"><PatientHistory /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default DoctorPage;
