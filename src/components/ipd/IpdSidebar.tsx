import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bed, Users, FilePlus, Calendar, PlusCircle, PiggyBank } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IpdSidebarProps {
  onNewAdmission: () => void;
  collapsed?: boolean;
}

export const IpdSidebar: React.FC<IpdSidebarProps> = ({ onNewAdmission, collapsed = false }) => {
  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} h-full bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col`}> 
      <div className={`p-4 border-b dark:border-gray-700 ${collapsed ? 'flex items-center justify-center' : ''}`}>
        {collapsed ? (
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">IPD</span>
        ) : (
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">IPD Dashboard</h2>
        )}
      </div>
      
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1`}>
        <NavLink 
          to="/ipd" 
          className={({isActive}) => `${collapsed ? 'justify-center' : ''} flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          {!collapsed && <span>Dashboard</span>}
        </NavLink>
        
        <NavLink 
          to="/ipd/beds" 
          className={({isActive}) => `${collapsed ? 'justify-center' : ''} flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          <Bed className="w-5 h-5" />
          {!collapsed && <span>Bed Management</span>}
        </NavLink>
        
        <NavLink 
          to="/ipd/patients" 
          className={({isActive}) => `${collapsed ? 'justify-center' : ''} flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          <Users className="w-5 h-5" />
          {!collapsed && <span>Patient List</span>}
        </NavLink>
        
        <NavLink 
          to="/ipd/admissions" 
          className={({isActive}) => `${collapsed ? 'justify-center' : ''} flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          <FilePlus className="w-5 h-5" />
          {!collapsed && <span>Admissions</span>}
        </NavLink>
        
        <NavLink 
          to="/ipd/schedule" 
          className={({isActive}) => `${collapsed ? 'justify-center' : ''} flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          <Calendar className="w-5 h-5" />
          {!collapsed && <span>Schedule</span>}
        </NavLink>
        
        <NavLink 
          to="/ipd/finance" 
          className={({isActive}) => `${collapsed ? 'justify-center' : ''} flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          <PiggyBank className="w-5 h-5" />
          {!collapsed && <span>Finance</span>}
        </NavLink>

        <NavLink 
          to="/ipd/finance/expenses" 
          className={({isActive}) => `${collapsed ? 'justify-center' : ''} flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
        >
          <PlusCircle className="w-5 h-5" />
          {!collapsed && <span>Expenses</span>}
        </NavLink>
      </nav>
      
      <div className={`p-4 border-t dark:border-gray-700`}>
        {collapsed ? (
          <Button 
            className="w-8 h-8 p-0 rounded-full mx-auto block"
            variant="secondary"
            onClick={onNewAdmission}
            title="Quick Admission"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            className="w-full mt-4"
            onClick={onNewAdmission}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Quick Admission
          </Button>
        )}
      </div>
    </div>
  );
};
