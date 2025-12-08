import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, ChevronsUpDown, Building } from "lucide-react";
import SlideButton from "@/components/SlideButton";
import FormSelection from "@/pages/FormSelection";
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
  const [showFormSelection, setShowFormSelection] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
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
      setShowFormSelection(true);
    }
  };

  const handleFormSelected = (formId: string | null) => {
    setSelectedFormId(formId);
    setShowFormSelection(false);
    setShowConversation(true);
  };

  const handleBackFromFormSelection = () => {
    setShowFormSelection(false);
  };

  // Show interview interface
  if (showConversation) {
    return (
      <TranscriptionInterface
        userId={selectedUserId}
        userName={selectedUser?.name || ""}
        initialFormId={selectedFormId}
      />
    );
  }

  // Show form selection page
  if (showFormSelection && selectedUserId && selectedUser) {
    return (
      <FormSelection
        userId={selectedUserId}
        userName={selectedUser.name}
        onFormSelected={handleFormSelected}
        onBack={handleBackFromFormSelection}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 lg:p-6 relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />

      <div className="max-w-md w-full space-y-6 lg:space-y-8 relative z-10 animate-fade-in-up">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Medical Interview
          </h1>
          <p className="text-base lg:text-lg text-muted-foreground">
            Select center and user to start the interview
          </p>
        </div>

        <Form {...form}>
          <form className="space-y-6 animate-slide-in">
            {/* Center Selection */}
            <FormField
              control={form.control}
              name="centerId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-base flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Select Center
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
                            "w-full justify-between h-12 text-base",
                            !field.value && "text-muted-foreground"
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
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search centers..." />
                        <CommandList>
                          {isLoadingCenters ? (
                            <CommandEmpty>Loading centers...</CommandEmpty>
                          ) : centerError ? (
                            <CommandEmpty>
                              Error loading centers: {centerError}
                            </CommandEmpty>
                          ) : centers.length === 0 ? (
                            <CommandEmpty>No centers found.</CommandEmpty>
                          ) : (
                            <>
                              <CommandEmpty>No center found.</CommandEmpty>
                              <CommandGroup>
                                {centers.map((center) => (
                                  <CommandItem
                                    key={center._id}
                                    value={center.name}
                                    onSelect={() => {
                                      form.setValue("centerId", center._id, {
                                        shouldValidate: true,
                                      });
                                      setCenterOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === center._id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
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
                    <p className="text-sm text-destructive mt-1">{centerError}</p>
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
                  <FormLabel className="text-base">Select User</FormLabel>
                  <Popover open={userOpen} onOpenChange={setUserOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={userOpen}
                          disabled={!selectedCenterId || isLoadingUsers}
                          className={cn(
                            "w-full justify-between h-12 text-base",
                            !field.value && "text-muted-foreground"
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
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search users..." 
                          value={userSearch}
                          onValueChange={setUserSearch}
                        />
                        <CommandList>
                          {!selectedCenterId ? (
                            <CommandEmpty>Please select a center first</CommandEmpty>
                          ) : isLoadingUsers ? (
                            <CommandEmpty>Loading users...</CommandEmpty>
                          ) : userError ? (
                            <CommandEmpty>
                              Error loading users: {userError}
                            </CommandEmpty>
                          ) : users.length === 0 ? (
                            <CommandEmpty>No users found.</CommandEmpty>
                          ) : (
                            <>
                              <CommandEmpty>No user found.</CommandEmpty>
                              <CommandGroup>
                                {users.map((user) => (
                                  <CommandItem
                                    key={user.id}
                                    value={`${user.name} ${user.id}`}
                                    onSelect={() => {
                                      form.setValue("userId", user.id, {
                                        shouldValidate: true,
                                      });
                                      setUserOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === user.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col items-start">
                                      <span>{user.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {user.id}
                                      </span>
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
                    <p className="text-sm text-destructive mt-1">{userError}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <SlideButton
              onSlideComplete={handleLogin}
              text={isFormValid ? "Slide to Login" : "Select Center and User First"}
              disabled={!isFormValid}
            />
          </form>
        </Form>
      </div>
    </div>
  );
};

export default Index;
