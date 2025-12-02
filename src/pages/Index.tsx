import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, ChevronsUpDown } from "lucide-react";
import SlideButton from "@/components/SlideButton";
import FormSelection from "@/pages/FormSelection";
import TranscriptionInterface from "@/components/TranscriptionInterface";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/config/api";
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

interface User {
  id: string;
  name: string;
}

const loginSchema = z.object({
  userId: z.string().min(1, { message: "Please select a user" }),
});

type LoginForm = z.infer<typeof loginSchema>;

const Index = () => {
  const [showFormSelection, setShowFormSelection] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      userId: "",
    },
  });

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        setUserError(null);
        const response = await fetch(getApiUrl("/api/users"));
        if (!response.ok) {
          throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
        const data = await response.json();
        // Map API response to component format
        const mappedUsers: User[] = (data.users || []).map((user: any) => ({
          id: user.id,
          name:
            user.fullName ||
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            "Unknown User",
        }));
        setUsers(mappedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        setUserError(error instanceof Error ? error.message : "Failed to load users");
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const selectedUserId = form.watch("userId");
  const selectedUser = users.find((user) => user.id === selectedUserId);
  const isFormValid = form.formState.isValid && selectedUserId && !isLoadingUsers;

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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full space-y-8">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold text-foreground">
            Medical Interview
          </h1>
          <p className="text-lg text-muted-foreground">
            Select your profile to start the interview
          </p>
        </div>

        <Form {...form}>
          <form className="space-y-6">
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-base">Select User</FormLabel>
                  <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={open}
                          disabled={isLoadingUsers}
                          className={cn(
                            "w-full justify-between h-12 text-base",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {isLoadingUsers
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
                        <CommandInput placeholder="Search users..." />
                        <CommandList>
                          {isLoadingUsers ? (
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
                                    value={user.name}
                                    onSelect={() => {
                                      form.setValue("userId", user.id, {
                                        shouldValidate: true,
                                      });
                                      setOpen(false);
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
              text={isFormValid ? "Slide to Login" : "Select User First"}
              disabled={!isFormValid}
            />
          </form>
        </Form>
      </div>
    </div>
  );
};

export default Index;
