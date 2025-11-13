import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIpdSchedule, useDeleteScheduleEvent, IpdScheduleEvent } from '@/hooks/useIpdApi';
import ScheduleDialog from './ScheduleDialog';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Clock, User, Stethoscope, CalendarOff, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

const IpdSchedule: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<IpdScheduleEvent | null>(null);
  
  const { data: schedule, isLoading, error } = useIpdSchedule(format(selectedDate, 'yyyy-MM-dd'));
  const deleteEventMutation = useDeleteScheduleEvent();

  const handleEdit = (event: IpdScheduleEvent) => {
    setSelectedEvent(event);
    setIsDialogOpen(true);
  };

  const handleDelete = (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this scheduled visit?')) {
      deleteEventMutation.mutate(eventId);
    }
  };

  const handleAddNew = () => {
    setSelectedEvent(null);
    setIsDialogOpen(true);
  };

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formattedDateHeader = selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6 p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={'outline'} className="w-[280px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => setSelectedDate(date || new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div>
              <CardTitle>Schedule for {format(selectedDate, 'MMMM do')}</CardTitle>
              <p className="text-sm text-gray-500">{formattedDateHeader}</p>
            </div>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="mr-2 h-4 w-4" /> Schedule New Visit
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-gray-500 py-8">Loading schedule...</p>
          ) : error ? (
            <p className="text-center text-red-500 py-8">Failed to load schedule.</p>
          ) : schedule && schedule.length > 0 ? (
            <div className="space-y-6">
              {schedule.map((event) => (
                <div key={event._id} className="hover:bg-gray-50 p-4 rounded-lg border transition-all flex justify-between items-start">
                  <Link to={`/ipd/patients/${event.patientObjId}`} className="flex-grow">
                    <div className="flex items-start space-x-4">
                      <div className="flex flex-col items-center text-blue-600">
                        <Clock className="h-6 w-6" />
                        <span className="text-sm font-semibold mt-1">{formatTime(event.dateTime)}</span>
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <p className="font-semibold text-lg text-gray-800">{event.patientName} <span className="text-sm font-normal text-gray-500">({event.mrNumber})</span></p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Stethoscope className="h-4 w-4 text-gray-500" />
                          <p className="text-sm text-gray-600">Visit with {event.doctorName}</p>
                        </div>
                        {event.notes && <p className="text-xs text-gray-500 mt-2 pl-6">Notes: {event.notes}</p>}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(event)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(event._id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <CalendarOff className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No scheduled visits</h3>
              <p className="mt-1 text-sm text-gray-500">There are no doctor visits scheduled for this day.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <ScheduleDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} event={selectedEvent} />
    </div>
  );
};

export default IpdSchedule;


