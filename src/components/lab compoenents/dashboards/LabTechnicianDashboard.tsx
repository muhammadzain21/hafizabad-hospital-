
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NotificationBell from "@/components/lab compoenents/common/NotificationBell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CurrentView } from "@/lab pages/Index";
import { 
  TestTube, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Plus,
  Microscope,
  FileText,
  Package,
  Wrench,
  Search,
  Filter,
  TrendingUp,
  Users,
  Calendar,
  BarChart3
} from "lucide-react";
import { api } from "@/lib/api";

interface LabTechnicianDashboardProps {
  onViewChange: (view: CurrentView) => void;
}

const LabTechnicianDashboard = ({ onViewChange }: LabTechnicianDashboardProps) => {

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("all");

  // Helper: parse 12-hour time string to Date on today
  const parseSampleTime = (timeStr: string) => {
    const [time, meridian] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (meridian && meridian.toLowerCase() === "pm" && hours < 12) hours += 12;
    if (meridian && meridian.toLowerCase() === "am" && hours === 12) hours = 0;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  };

  // For demo/mock data: assume completed samples have today's date
  const now = new Date();
  const isToday = (dateObj: Date) => {
    return dateObj.getDate() === now.getDate() &&
           dateObj.getMonth() === now.getMonth() &&
           dateObj.getFullYear() === now.getFullYear();
  };

  // Compute dynamic stats
  const [recentSamples, setRecentSamples] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ pending: 0, inProgress: 0, completedToday: 0, urgent: 0 });

  // fetch samples on mount
  useEffect(() => {
    api.get(`/labtech/samples`)
      .then(({ data }) => {
        const mapped = data
          .sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0,10)
          .map((s:any)=>({
            id: s._id,
            patient: s.patientName || "Unknown",
            test: Array.isArray(s.tests) && s.tests.length ? (typeof s.tests[0]==='string'? s.tests[0] : (s.tests[0].name || 'Test')) : 'Test',
            status: s.status || 'received',
            priority: s.priority || 'normal',
            receivedTime: new Date(s.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
            expectedTime: s.expectedCompletion ? new Date(s.expectedCompletion).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-',
            technician: s.processedBy || 'You'
          }));
        setRecentSamples(mapped);
      })
      .catch(()=>setRecentSamples([]));
  }, []);

  // Fetch KPIs from server
  useEffect(() => {
    api.get(`/lab/dashboard/kpis`)
      .then(({ data }) => {
        setKpis(data);
      })
      .catch(() => {
        // keep defaults; UI will fallback to client-derived values below
      });
  }, []);

  // Fallback client-side counts if KPI API is not available
  const fallbackPending = recentSamples.filter((s:any) => s.status === "pending" || s.status === "received").length;
  const fallbackInProgress = recentSamples.filter((s:any)=> s.status === "in-progress" || s.status === "processing").length;
  const fallbackCompletedToday = recentSamples.filter((s:any)=> s.status === "completed").length;
  const fallbackUrgent = recentSamples.filter((s:any)=> s.priority === "urgent" || s?.results?.some?.((r:any)=>r?.isCritical)).length;

  const pendingCount = kpis.pending || fallbackPending;
  const inProgressCount = kpis.inProgress || fallbackInProgress;
  const completedTodayCount = kpis.completedToday || fallbackCompletedToday;
  const urgentCount = kpis.urgent || fallbackUrgent;

  const stats = [
    {
      label: "Pending Tests",
      value: pendingCount,
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-50",
      trend: "",
      description: "Tests awaiting processing"
    },
    {
      label: "In Progress",
      value: inProgressCount,
      icon: TestTube,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      trend: "",
      description: "Currently being analyzed"
    },
    {
      label: "Completed Today",
      value: completedTodayCount,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-50",
      trend: "",
      description: "Successfully completed (last 24h)"
    },
    {
      label: "Urgent Tests",
      value: urgentCount,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-50",
      trend: "",
      description: "Requires immediate attention"
    },
  ];

  const quickActions = [
    { 
      title: "Sample Intake", 
      description: "Register new samples", 
      icon: Plus, 
      view: "sample-intake" as CurrentView,
      color: "bg-gradient-to-r from-blue-500 to-blue-600",
      isWorking: true
    },
    { 
      title: "Test Catalog", 
      description: "View available tests", 
      icon: TestTube, 
      view: "test-catalog" as CurrentView,
      color: "bg-gradient-to-r from-green-500 to-green-600",
      isWorking: true
    },
    { 
      title: "Sample Tracking", 
      description: "Track sample progress", 
      icon: Microscope, 
      view: "sample-tracking" as CurrentView,
      color: "bg-gradient-to-r from-purple-500 to-purple-600",
      isWorking: true
    },
    { 
      title: "Result Entry", 
      description: "Enter test results", 
      icon: FileText, 
      view: "result-entry" as CurrentView,
      color: "bg-gradient-to-r from-orange-500 to-orange-600",
      isWorking: true
    },
    { 
      title: "Inventory", 
      description: "Manage supplies", 
      icon: Package, 
      view: "inventory" as CurrentView,
      color: "bg-gradient-to-r from-red-500 to-red-600",
      isWorking: true
    },
    { 
      title: "Equipment", 
      description: "Monitor equipment", 
      icon: Wrench, 
      view: "equipment" as CurrentView,
      color: "bg-gradient-to-r from-indigo-500 to-indigo-600",
      isWorking: true
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "in-progress": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "normal": return "bg-gray-500 text-white";
      default: return "bg-gray-400 text-white";
    }
  };

  const filteredSamples = recentSamples.filter(sample => {
    const matchesSearch = sample.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sample.test.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sample.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = selectedPriority === "all" || sample.priority === selectedPriority;
    return matchesSearch && matchesPriority;
  });

  return (
    <div className="p-4 md:p-6 w-full max-w-full mx-0 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lab Technician Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage samples, tests, and laboratory operations</p>
        </div>
        <div className="flex items-center space-x-3">
          <NotificationBell />
          <Button 
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => onViewChange("notifications")}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Button>
          <Button 
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            onClick={() => onViewChange("sample-intake")}
          >
            <Plus className="w-4 h-4" />
            New Sample
          </Button>
        </div>
      </div>

      {/* Stats Grid (Pending & Urgent removed) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.filter(s => s.label !== "Pending Tests" && s.label !== "Urgent Tests").map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.label} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.label}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <IconComponent className={`w-4 h-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      stat.trend.includes('+') ? 'bg-green-100 text-green-800' : 
                      stat.trend.includes('-') ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                      {stat.trend}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{stat.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Microscope className="w-5 h-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>Access commonly used laboratory functions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => {
              const IconComponent = action.icon;
              return (
                <Button
                  key={action.title}
                  variant="outline"
                  className="h-auto p-6 flex flex-col items-center space-y-3 hover:shadow-lg transition-all duration-300 border-2 hover:border-blue-200"
                  onClick={() => onViewChange(action.view)}
                >
                  <div className={`p-3 rounded-xl ${action.color} text-white`}>
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{action.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                    {action.isWorking && (
                      <Badge variant="outline" className="mt-2 text-xs bg-green-50 text-green-700 border-green-200">
                        ✓ Functional
                      </Badge>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Samples removed */}
    </div>
  );
};

export default LabTechnicianDashboard;
