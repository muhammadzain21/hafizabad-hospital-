import React from 'react';
import { Button } from '@/components/ui/button';
import heroImg from '@/assets/doctor-hero.svg';
import { IpdAdmission, Bed } from '@/hooks/useIpdApi';
import { useIpdContext } from '@/pages/Ipd';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Bed as BedIcon, FilePlus, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
 

export const IpdDashboard: React.FC = () => {
  const { admissions, beds, setShowAdmissionModal } = useIpdContext();

  // Calculate metrics
  const occupiedBeds = beds.filter(b => b.status === 'Occupied').length;
  const availableBeds = beds.filter(b => b.status === 'Available').length;
  const todaysAdmissions = admissions.filter(a => 
    new Date(a.admitDateTime).toDateString() === new Date().toDateString()
  ).length;

  // Generate weekly admissions data
  const getWeeklyAdmissionsData = (admissions) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    
    return days.map((day, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - today.getDay() + i);
      
      return {
        name: day,
        admissions: admissions.filter(a => {
          const admitDate = new Date(a.admitDateTime);
          return admitDate.toDateString() === date.toDateString();
        }).length
      };
    });
  };

  const weeklyData = getWeeklyAdmissionsData(admissions);

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
        <div className="p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-center gap-8 md:gap-16 max-w-7xl mx-auto">
          <div className="flex-1 z-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              In-Patient Department
            </h1>
            <p className="text-white/90 text-lg mb-6 max-w-md">
              Manage patient admissions, bed allocation and discharge processes.
            </p>
            <Button 
              variant="outline" 
              className="bg-white/10 hover:bg-white/20 border-white/30"
              onClick={() => setShowAdmissionModal(true)}
            >
              New Admission
            </Button>
          </div>
          <img
            src={heroImg}
            alt="IPD Illustration"
            className="w-48 md:w-56 lg:w-64 drop-shadow-xl"
          />
        </div>
        {/* decorative blurred blob */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-cyan-400/30 rounded-full filter blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-400/30 rounded-full filter blur-3xl" />
      </section>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{admissions.length}</div>
            <p className="text-xs text-muted-foreground">Currently admitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied Beds</CardTitle>
            <BedIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupiedBeds}</div>
            <p className="text-xs text-muted-foreground">out of {beds.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Beds</CardTitle>
            <BedIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableBeds}</div>
            <p className="text-xs text-muted-foreground">Ready for new admissions</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {beds.length ? Math.round((occupiedBeds / beds.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">bed utilization</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Admissions Chart */}
      <div className="max-w-7xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Admissions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="admissions" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
};


