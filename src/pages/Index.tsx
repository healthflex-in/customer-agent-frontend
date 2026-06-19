import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, ChevronsUpDown, Building } from "lucide-react";
import SlideButton from "@/components/SlideButton";
import TranscriptionInterface from "@/components/TranscriptionInterface";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fetchCenters, searchUsersWithPagination } from "@/utils/graphql-client";

interface User {
  id: string;
  name: string;
}

interface Center {
  _id: string;
  name: string;
}

const loginSchema = z.object({
  centerId: z.string().min(1, { message: "Please select a center" }),
  userId: z.string().min(1, { message: "Please select a user" }),
});

type LoginForm = z.infer<typeof loginSchema>;

const Index = () => {
  const { userId: pathUserId, formId: pathFormId } = useParams<{ userId?: string; formId?: string }>();
  const navigate = useNavigate();

  const [showConversation, setShowConversation] = useState(!!pathUserId);
  const [urlFormId, setUrlFormId] = useState<string | null>(pathFormId || null);
  const [urlUserId, setUrlUserId] = useState<string | null>(pathUserId || null);
  const [userOpen, setUserOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [centerOpen, setCenterOpen] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingCenters, setIsLoadingCenters] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [centerError, setCenterError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      centerId: "",
      userId: "",
    },
  });

  const selectedCenterId = form.watch("centerId");
  const selectedUserId = form.watch("userId");

  // Read from URL path params (/{userId}/{formId}) or fallback to query params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Path params already handled by useParams above — skip if present
    if (pathUserId) return;

    const urlParams = new URLSearchParams(window.location.search);
    const FIXED_FORM_ID = "FRM-01";
    const paramUserId = urlParams.get("userId");
    const urlCenterId = urlParams.get("centerId");

    if (paramUserId && urlCenterId) {
      setUrlFormId(FIXED_FORM_ID);
      setUrlUserId(paramUserId);
      form.setValue("userId", paramUserId, { shouldValidate: true });
      form.setValue("centerId", urlCenterId, { shouldValidate: true });
      setShowConversation(true);
    }
  }, [form, pathUserId]);

  // Fetch centers on mount
  useEffect(() => {
    const loadCenters = async () => {
      try {
        setIsLoadingCenters(true);
        setCenterError(null);
        const response = await fetchCenters();
        if (response?.centers) {
          setCenters(response.centers);
        }
      } catch (error) {
        console.error("Error fetching centers:", error);
        setCenterError(error instanceof Error ? error.message : "Failed to load centers");
      } finally {
        setIsLoadingCenters(false);
      }
    };

    loadCenters();
  }, []);

  // Search users when search term changes
  useEffect(() => {
    if (!selectedCenterId) {
      setUsers([]);
      form.setValue("userId", "");
      return;
    }

    if (!userSearch) {
      setUsers([]);
      return;
    }

    const delaySearch = setTimeout(async () => {
      try {
        setIsLoadingUsers(true);
        setUserError(null);
        const response = await searchUsersWithPagination('PATIENT', [selectedCenterId], userSearch);

        // Map GraphQL response to component format
        const mappedUsers: User[] = (response?.users?.data || []).map((user: any) => ({
          id: user._id,
          name:
            `${user.profileData?.firstName || ""} ${user.profileData?.lastName || ""}`.trim() ||
            "Unknown User",
        }));
        setUsers(mappedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        setUserError(error instanceof Error ? error.message : "Failed to load users");
      } finally {
        setIsLoadingUsers(false);
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [selectedCenterId, userSearch]);

  const selectedUser = users.find((user) => user.id === selectedUserId);
  const isFormValid = form.formState.isValid && selectedCenterId && selectedUserId && !isLoadingUsers;

  const handleLogin = () => {
    if (isFormValid) {
      const FIXED_FORM_ID = "FRM-01";
      // Update URL to /{userId}/{formId} for deep-linking and refresh persistence
      navigate(`/${selectedUserId}/${FIXED_FORM_ID}`, { replace: true });
      setUrlUserId(selectedUserId);
      setUrlFormId(FIXED_FORM_ID);
      setShowConversation(true);
    }
  };

  // Show interview interface
  if (showConversation) {
    // Path params always win — they come directly from the URL so they survive
    // backend restarts and page refreshes without stale state contamination.
    const userIdToUse = pathUserId || urlUserId || selectedUserId;
    const formIdToRender = pathFormId || urlFormId || null;
    console.log(`[Index] Showing conversation with userId=${userIdToUse}, formId=${formIdToRender}`);
    return (
      <TranscriptionInterface
        userId={userIdToUse}
        userName={selectedUser?.name || ""}
        initialFormId={formIdToRender}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stance-steel flex items-center justify-center relative overflow-hidden px-4 py-12">
      {/* Background glow accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-stance-neon/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-stance-stone/8 rounded-full blur-[120px] pointer-events-none" />

      {/* Centered content */}
      <div className="w-full max-w-sm space-y-8 relative z-10">

        {/* Logo — centered above heading */}
        <div className="flex justify-center">
          <img src="/assets/brand/logo-white.png" alt="Stance Health" className="h-16 w-auto max-w-[220px]" />
        </div>

        {/* Title */}
        <div className="space-y-2 text-center">
          <h1 className="font-display text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
            Start your consultation.
          </h1>
          <p className="text-stance-stone/60 text-sm">
            Select your clinic and patient to begin.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/6 border border-white/12 rounded-3xl p-6 space-y-5 backdrop-blur-sm shadow-2xl">
        <Form {...form}>
          <form className="space-y-5">
            {/* Center Selection */}
            <FormField
              control={form.control}
              name="centerId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-stance-stone/70 flex items-center gap-2">
                    <Building className="h-3.5 w-3.5" />
                    Clinic / Center
                  </FormLabel>
                  <Popover open={centerOpen} onOpenChange={setCenterOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={centerOpen}
                          disabled={isLoadingCenters}
                          className={cn(
                            "w-full justify-between h-12 text-sm bg-white/8 border-white/15 text-white hover:bg-white/12 hover:text-white",
                            !field.value && "text-white/55"
                          )}
                        >
                          {isLoadingCenters
                            ? "Loading centers..."
                            : field.value
                              ? (() => {
                                const center = centers.find(
                                  (c) => c._id === field.value
                                );
                                return center ? center.name : "Select a center...";
                              })()
                              : "Select a center..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-stance-steel border-white/15" align="start">
                      <Command className="bg-transparent">
                        <CommandInput placeholder="Search centers..." className="text-white placeholder:text-white/40 border-white/10" />
                        <CommandList>
                          {isLoadingCenters ? (
                            <CommandEmpty className="text-white/50">Loading centers...</CommandEmpty>
                          ) : centerError ? (
                            <CommandEmpty className="text-red-400">Error loading centers</CommandEmpty>
                          ) : centers.length === 0 ? (
                            <CommandEmpty className="text-white/50">No centers found.</CommandEmpty>
                          ) : (
                            <>
                              <CommandEmpty className="text-white/50">No center found.</CommandEmpty>
                              <CommandGroup>
                                {centers.map((center) => (
                                  <CommandItem
                                    key={center._id}
                                    value={center.name}
                                    className="text-white hover:bg-white/10 aria-selected:bg-white/10"
                                    onSelect={() => {
                                      form.setValue("centerId", center._id, { shouldValidate: true });
                                      setCenterOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4 text-stance-neon", field.value === center._id ? "opacity-100" : "opacity-0")} />
                                    <span>{center.name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {centerError && (
                    <p className="text-xs text-red-400 mt-1">{centerError}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* User Selection */}
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-stance-stone/70">
                    Patient
                  </FormLabel>
                  <Popover open={userOpen} onOpenChange={setUserOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={userOpen}
                          disabled={!selectedCenterId || isLoadingUsers}
                          className={cn(
                            "w-full justify-between h-12 text-sm bg-white/8 border-white/15 text-white hover:bg-white/12 hover:text-white",
                            !field.value && "text-white/55"
                          )}
                        >
                          {!selectedCenterId
                            ? "Select a center first"
                            : isLoadingUsers
                              ? "Loading users..."
                              : field.value
                                ? (() => {
                                  const user = users.find(
                                    (u) => u.id === field.value
                                  );
                                  return user
                                    ? `${user.name} (${user.id})`
                                    : "Type or select a user...";
                                })()
                                : "Type or select a user..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 bg-stance-steel border-white/15" align="start">
                      <Command className="bg-transparent">
                        <CommandInput
                          placeholder="Search patients..."
                          value={userSearch}
                          onValueChange={setUserSearch}
                          className="text-white placeholder:text-white/40 border-white/10"
                        />
                        <CommandList>
                          {!selectedCenterId ? (
                            <CommandEmpty className="text-white/50">Select a center first</CommandEmpty>
                          ) : isLoadingUsers ? (
                            <CommandEmpty className="text-white/50">Loading...</CommandEmpty>
                          ) : userError ? (
                            <CommandEmpty className="text-red-400">Error loading patients</CommandEmpty>
                          ) : users.length === 0 ? (
                            <CommandEmpty className="text-white/50">No patients found.</CommandEmpty>
                          ) : (
                            <>
                              <CommandEmpty className="text-white/50">No patient found.</CommandEmpty>
                              <CommandGroup>
                                {users.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={`${user.name} ${user.id}`}
                                    className="text-white hover:bg-white/10 aria-selected:bg-white/10"
                                    onSelect={() => {
                                      form.setValue("userId", user.id, { shouldValidate: true });
                                      setUserOpen(false);
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4 text-stance-neon", field.value === user.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col items-start">
                                      <span>{user.name}</span>
                                      <span className="text-[10px] text-white/40">{user.id}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {userError && (
                    <p className="text-xs text-red-400 mt-1">{userError}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <SlideButton
              onSlideComplete={handleLogin}
              text={isFormValid ? "Slide to start" : "Select clinic and patient first"}
              disabled={!isFormValid}
            />
          </form>
        </Form>
        </div>
      </div>
    </div>
  );
};

export default Index;
