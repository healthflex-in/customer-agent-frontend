import React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { fetchAppointments } from '@/utils/graphql-client';

export type Appointment = {
  _id: string;
  appointment: {
    _id: string;
    seqNo: string;
    event: {
      startTime: string;
      endTime: string;
    };
  };
};

export const useAppointments = (patientId: string) => {
  const { toast } = useToast();

  const isAutoSelectingRef = React.useRef(false);

  const [appointmentId, setAppointmentId] = React.useState<string>('');
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = React.useState(false);
  const [lastLoadedPatientId, setLastLoadedPatientId] =
    React.useState<string>('');

  const clearAppointments = React.useCallback(() => {
    setAppointments([]);
    setAppointmentId('');
    setLastLoadedPatientId('');
    isAutoSelectingRef.current = false;
  }, []);

  const handleAppointmentChange = React.useCallback(
    (newAppointmentId: string) => {
      // Only process if this is not an auto-selection
      if (!isAutoSelectingRef.current) {
        setAppointmentId(newAppointmentId);
      } else {
        // Reset the flag after auto-selection is processed
        isAutoSelectingRef.current = false;
      }
    },
    []
  );

  // Load appointments when patient changes
  React.useEffect(() => {
    const loadAppointments = async (currentPatientId: string) => {
      // Prevent loading if already loading for the same patient
      if (loadingAppointments && lastLoadedPatientId === currentPatientId) {
        return;
      }

      // Validate patientId before making the request
      if (!currentPatientId || currentPatientId.trim() === '') {
        console.warn('Cannot load appointments: patientId is empty or invalid');
        return;
      }

      try {
        setLoadingAppointments(true);
        setLastLoadedPatientId(currentPatientId);

        console.log('Loading appointments for patientId:', currentPatientId);
        const response = await fetchAppointments(currentPatientId);

        if (response && response.reports) {
          // Filter out reports without appointments and sort by startTime (most recent first)
          const sortedAppointments = response.reports
            .filter(
              (report) =>
                report && report._id && report.appointment?.event?.startTime
            )
            .sort(
              (a, b) =>
                new Date(b.appointment.event.startTime).getTime() -
                new Date(a.appointment.event.startTime).getTime()
            );
          setAppointments(sortedAppointments);

          // Check if we should restore from localStorage
          const savedAppointmentId = localStorage.getItem('appointmentId');
          const savedPatientId = localStorage.getItem('userId');

          if (savedPatientId === currentPatientId && savedAppointmentId) {
            // Restore from localStorage if the appointment exists in the list
            const appointmentExists = sortedAppointments.find(
              (apt) => apt.appointment._id === savedAppointmentId
            );
            if (appointmentExists) {
              isAutoSelectingRef.current = true;
              setAppointmentId(savedAppointmentId);
              return;
            }
          }

          // Auto-select the most recent appointment
          if (sortedAppointments.length > 0) {
            const mostRecentAppointment = sortedAppointments[0];
            console.log('@@ mostRecentAppointment: ', mostRecentAppointment);
            isAutoSelectingRef.current = true;
            setAppointmentId(mostRecentAppointment.appointment._id);
          }
        }
      } catch (error) {
        console.error('Error fetching appointments:', error);
        toast({
          title: 'Error',
          description: 'Failed to load appointments. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoadingAppointments(false);
      }
    };

    if (
      patientId &&
      patientId.trim() !== '' &&
      patientId !== lastLoadedPatientId
    ) {
      loadAppointments(patientId);
    } else if (!patientId) {
      clearAppointments();
    }
  }, [
    patientId,
    lastLoadedPatientId,
    loadingAppointments,
    toast,
    clearAppointments,
  ]);

  return {
    appointments,
    appointmentId,
    loadingAppointments,
    handleAppointmentChange,
    clearAppointments,
  };
};

