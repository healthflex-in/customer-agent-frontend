import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigate, useParams } from "react-router-dom";
import Index from "./pages/Index";
import FormPage from "./pages/FormPage";
import DirectFormPage from "./pages/DirectFormPage";
import NotFound from "./pages/NotFound";

// Redirects /:userId → /:userId/FRM-01
function UserRedirect() {
  const { userId } = useParams<{ userId: string }>();
  return <Navigate to={`/${userId}/FRM-01`} replace />;
}

// Redirect /consent/:userId → external consent site
function ConsentRedirect() {
  const { userId } = useParams<{ userId: string }>();
  const isDev = import.meta.env.DEV || window.location.hostname.startsWith('dev.');
  const consentBase = isDev ? 'https://dev.consent.stance.health' : 'https://consent.stance.health';
  window.location.replace(`${consentBase}/${userId}`);
  return null;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* /consent/:userId → redirect to real external consent site */}
          <Route path="/consent/:userId" element={<ConsentRedirect />} />
          {/* Clean URL: /{userId}/{formId} — deep-linkable interview sessions */}
          <Route path="/:userId/:formId" element={<Index />} />
          {/* /:userId without formId — redirect to default form */}
          <Route path="/:userId" element={<UserRedirect />} />
          <Route
            path="/:formKey/:patientId/:appointmentId"
            element={<FormPage />}
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
