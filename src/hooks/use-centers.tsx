import React from 'react';

import { useToast } from '@/components/ui/use-toast';
import { fetchCenters } from '@/utils/graphql-client';

export type Center = {
  _id: string;
  name: string;
};

export const useCenters = () => {
  const { toast } = useToast();
  const [centers, setCenters] = React.useState<Center[]>([]);
  const [loadingCenters, setLoadingCenters] = React.useState(false);

  const loadCenters = React.useCallback(async () => {
    try {
      setLoadingCenters(true);
      const response = await fetchCenters();
      if (response && response.centers) {
        setCenters(response.centers);
      }
    } catch (error) {
      console.error('Error fetching centers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load centers. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCenters(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadCenters();
  }, [loadCenters]);

  return { centers, loadingCenters, loadCenters };
};

