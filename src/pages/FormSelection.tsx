import { useState, useEffect } from "react";
import { FormSelectionCard } from "@/components/cards/FormSelectionCard";
import { MultipleChoiceCard } from "@/components/MultipleChoiceCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getApiUrl } from "@/config/api";

interface Form {
  formId: string;
  attemptId?: string | null;
  title: string;
  timestamp?: string;
  createdAt: string;
  updatedAt: string;
  current_section: string;
  progress: number;
}

interface FormSelectionProps {
  userId: string;
  userName: string;
  onFormSelected: (formId: string | null, attemptId?: string | null) => void;
  onBack?: () => void;
}

const FormSelection = ({ userId, userName, onFormSelected, onBack }: FormSelectionProps) => {
  const [availableForms, setAvailableForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFormList, setShowFormList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForms = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(getApiUrl(`/api/users/${userId}/forms`));
        if (!response.ok) {
          throw new Error(`Failed to fetch forms: ${response.statusText}`);
        }
        const data = await response.json();
        const forms = data.forms || [];

        // Fetch up-to-date progress for each form
        const formsWithProgress = await Promise.all(
          forms.map(async (form: Form) => {
            try {
              const progressRes = await fetch(
                getApiUrl(
                  `/api/forms/${form.formId}/progress?userId=${encodeURIComponent(userId)}` +
                  (form.attemptId
                    ? `&attemptId=${encodeURIComponent(form.attemptId)}`
                    : "")
                )
              );
              if (!progressRes.ok) {
                throw new Error("Failed to fetch progress");
              }
              const progressData = await progressRes.json();
              const progressValue =
                typeof progressData?.progress === "number"
                  ? progressData.progress
                  : typeof progressData?.data?.progress === "number"
                  ? progressData.data.progress
                  : form.progress ?? 0;

              return {
                ...form,
                progress: progressValue,
              };
            } catch (err) {
              console.error(
                `Error fetching progress for form ${form.formId}:`,
                err
              );
              return form;
            }
          })
        );

        setAvailableForms(formsWithProgress);
      } catch (err) {
        console.error("Error fetching forms:", err);
        setError(err instanceof Error ? err.message : "Failed to load forms");
      } finally {
        setIsLoading(false);
      }
    };

    fetchForms();
  }, [userId]);

  const handleChoice = (value: string) => {
    if (value === "new") {
      // Start new form - pass null to indicate new form
      onFormSelected(null);
    } else if (value === "existing") {
      // Show existing forms list
      setShowFormList(true);
    }
  };

  const handleFormSelect = (formId: string, attemptId?: string | null) => {
    // Load existing form
    onFormSelected(formId, attemptId);
  };

  // If no forms exist, skip selection and start new form
  useEffect(() => {
    if (!isLoading && availableForms.length === 0 && !error && userId) {
      // Auto-start new form if no forms exist
      // Small delay to show the page briefly
      const timer = setTimeout(() => {
        onFormSelected(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, availableForms.length, error, userId, onFormSelected]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Medical Interview</h1>
          <p className="text-lg text-muted-foreground">
            Welcome, {userName}
          </p>
        </div>

        {/* Back Button */}
        {onBack && (
          <Button
            variant="ghost"
            onClick={onBack}
            className="absolute top-4 left-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 text-center">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              onClick={() => onFormSelected(null)}
              className="mt-4"
            >
              Start New Form Anyway
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center p-8">
            <p className="text-muted-foreground">Loading your forms...</p>
          </div>
        )}

        {/* Form Selection UI */}
        {!isLoading && !error && (
          <>
            {!showFormList && availableForms.length > 0 && (
              <MultipleChoiceCard
                style="clean"
                question="You have existing forms. What would you like to do?"
                options={[
                  { label: "Start a new form", value: "new" },
                  { label: "Fill an existing form", value: "existing" },
                ]}
                onSelect={handleChoice}
              />
            )}

            {showFormList && (
              <div className="space-y-4">
                <FormSelectionCard
                  forms={availableForms}
                  onSelectForm={handleFormSelect}
                />
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowFormList(false)}
                  >
                    Back
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FormSelection;
