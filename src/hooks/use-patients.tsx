import React from 'react';

import { searchUsersWithPagination } from '@/utils/graphql-client';
import { useToast } from '@/components/ui/use-toast';

export type Patient = {
  _id: string;
  profileData: {
    firstName: string;
    lastName: string;
  };
};

export const usePatients = (centerId: string) => {
  const { toast } = useToast();
  const [patients, setPatients] = React.useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = React.useState(false);

  const searchPatients = React.useCallback(
    async (searchTerm: string) => {
      if (!centerId) {
        toast({
          title: 'Center Required',
          description: 'Please select a center first',
          variant: 'destructive',
        });
        return;
      }

      try {
        setLoadingPatients(true);
        console.log('Calling searchUsersWithPagination...');
        const response = await searchUsersWithPagination<{
          users: { data: Patient[] };
        }>(
          'PATIENT',
          [centerId],
          searchTerm
        );
        console.log('Response received:', response);

        if (response && response.users && response.users.data) {
          setPatients(response.users.data);
        }
      } catch (error) {
        console.error('Error searching patients:', error);
        toast({
          title: 'Error',
          description: 'Failed to search patients. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoadingPatients(false);
      }
    },
    [centerId, toast]
  );

  const clearPatients = React.useCallback(() => {
    setPatients([]);
  }, []);

  return { patients, loadingPatients, searchPatients, clearPatients };
};
