import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import TranscriptionInterface from '@/components/TranscriptionInterface';

type FormPageParams = {
  formKey: string;
  patientId: string;
  appointmentId: string;
};

const FormPage = () => {
  const { formKey, patientId, appointmentId } = useParams<FormPageParams>();
  const navigate = useNavigate();

  // Get patient name from localStorage
  const savedPatient = localStorage.getItem('selectedPatient');
  const patientName = savedPatient
    ? JSON.parse(savedPatient).name
    : 'Patient';

  if (!patientId || !appointmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Missing Parameters</h1>
          <p className="text-muted-foreground mb-4">
            Patient ID or Appointment ID is missing.
          </p>
          <Button onClick={() => navigate('/')}>Go Back</Button>
        </div>
      </div>
    );
  }

  // Use TranscriptionInterface with the patient info
  return (
    <TranscriptionInterface
      userId={patientId}
      userName={patientName}
      initialFormId={null}
    />
  );
};

export default FormPage;

