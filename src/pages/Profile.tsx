import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo/SEO";
import { User, Mail, Calendar, Shield, Loader2, Check, AlertCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { format } from "date-fns";

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(100, "Display name must be less than 100 characters")
    .optional()
    .or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const { openCustomerPortal } = useSubscription();

  // Fetch profile data
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get subscription data from Stripe via the hook
  const { 
    tier: subscriptionTier, 
    subscribed, 
    subscriptionEnd,
    isLoading: subscriptionLoading,
    checkSubscription 
  } = useSubscription();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
    },
  });

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      form.reset({
        displayName: profile.display_name || "",
      });
    }
  }, [profile, form]);

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: values.displayName || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user!.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      setIsEditing(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
      console.error("Profile update error:", error);
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate(values);
  };

  const handleCancel = () => {
    form.reset({
      displayName: profile?.display_name || "",
    });
    setIsEditing(false);
  };

  const userInitials = profile?.display_name
    ? profile.display_name.substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "U";

  const getSubscriptionBadge = () => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      pro: "default",
      basic: "secondary",
      free: "outline",
    };

    const displayName: Record<string, string> = {
      pro: "Pro",
      basic: "Standard",
      free: "Free",
    };

    return (
      <Badge variant={variants[subscriptionTier] || "outline"} className="capitalize">
        {displayName[subscriptionTier] || subscriptionTier}
      </Badge>
    );
  };

  const handleManageBilling = async () => {
    setIsOpeningPortal(true);
    try {
      await openCustomerPortal();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
        variant: "destructive",
      });
      console.error("Customer portal error:", error);
    } finally {
      setIsOpeningPortal(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings and preferences
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-20 w-20 rounded-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            </div>
          ) : error ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Error Loading Profile</h3>
                <p className="text-muted-foreground mb-4">
                  There was a problem loading your profile.
                </p>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal information and how others see you
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    {/* Avatar */}
                    <div className="flex flex-col items-center gap-2">
                      <Avatar className="h-20 w-20">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    {/* Form */}
                    <div className="flex-1">
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="displayName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Display Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter your display name"
                                    disabled={!isEditing}
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  This is your public display name.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{user?.email}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Email cannot be changed
                            </p>
                          </div>

                          {isEditing ? (
                            <div className="flex gap-3 pt-2">
                              <Button
                                type="submit"
                                disabled={updateProfile.isPending}
                              >
                                {updateProfile.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={updateProfile.isPending}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsEditing(true)}
                              className="mt-2"
                            >
                              Edit Profile
                            </Button>
                          )}
                        </form>
                      </Form>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Account Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Account Details
                  </CardTitle>
                  <CardDescription>
                    View your account status and subscription information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {subscriptionLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">
                            Subscription Plan
                          </p>
                          <div className="flex items-center gap-2">
                            {getSubscriptionBadge()}
                            {subscribed && (
                              <span className="text-xs text-success">Active</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">
                            Member Since
                          </p>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {profile?.created_at
                                ? format(new Date(profile.created_at), "MMMM d, yyyy")
                                : "N/A"}
                            </span>
                          </div>
                        </div>

                        {subscriptionEnd && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              Next Billing Date
                            </p>
                            <span className="text-sm">
                              {format(new Date(subscriptionEnd), "MMMM d, yyyy")}
                            </span>
                          </div>
                        )}
                      </div>

                      <Separator />

                      <div className="flex flex-wrap gap-3">
                        <Button variant="outline" asChild>
                          <a href="/pricing">View Plans</a>
                        </Button>
                        {subscribed && (
                          <Button 
                            variant="outline"
                            onClick={handleManageBilling}
                            disabled={isOpeningPortal}
                          >
                            {isOpeningPortal ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Opening...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Manage Billing
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <SEO
        title="Profile Settings - CarWise"
        description="Manage your CarWise account settings and preferences"
      />
      <ProfileContent />
    </ProtectedRoute>
  );
}
