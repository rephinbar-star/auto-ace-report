import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { SEO } from "@/components/seo/SEO";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Shield, 
  Loader2, 
  Ban, 
  CheckCircle, 
  UserX,
  RefreshCw,
  Mail,
  Lock,
  ArrowRight,
  AlertTriangle,
  Trash2
} from "lucide-react";

interface Subscriber {
  userId: string;
  email: string;
  displayName: string | null;
  joinDate: string;
  plan: string;
  status: string;
  lastBillDate: string | null;
  nextBillDate: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  isBlocked: boolean;
}

type AuthStep = "password" | "otp" | "authenticated";

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Auth state
  const [authStep, setAuthStep] = useState<AuthStep>("password");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Admin data
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);

  // Dialog state
  const [selectedUser, setSelectedUser] = useState<Subscriber | null>(null);
  const [dialogType, setDialogType] = useState<"plan" | "block" | "delete" | null>(null);
  const [newPlan, setNewPlan] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Check session on mount
  useEffect(() => {
    const sessionToken = sessionStorage.getItem("adminSessionToken");
    const sessionExpiry = sessionStorage.getItem("adminSessionExpiry");
    
    if (sessionToken && sessionExpiry && Date.now() < parseInt(sessionExpiry)) {
      setAuthStep("authenticated");
    }
  }, []);

  const handlePasswordSubmit = async () => {
    if (!password) {
      toast({
        title: "Password required",
        description: "Please enter your admin password.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    try {
      // Validate password server-side
      const { data: validateData, error: validateError } = await supabase.functions.invoke("admin-validate-password", {
        body: { password },
      });
      
      if (validateError) throw validateError;
      
      if (!validateData?.success) {
        const remaining = validateData?.remaining;
        toast({
          title: "Invalid password",
          description: remaining !== undefined 
            ? `Please check your password and try again. ${remaining} attempts remaining.`
            : "Please check your password and try again.",
          variant: "destructive",
        });
        return;
      }

      // Password validated, now send OTP
      const { error } = await supabase.functions.invoke("admin-send-otp");
      
      if (error) throw error;
      
      setAuthStep("otp");
      toast({
        title: "Verification code sent",
        description: "Check your email for the 6-digit code.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify password";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otpCode.length !== 6) return;

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-verify-otp", {
        body: { code: otpCode },
      });

      if (error) throw error;

      // Store session
      sessionStorage.setItem("adminSessionToken", data.sessionToken);
      sessionStorage.setItem("adminSessionExpiry", data.sessionExpiry.toString());
      
      setAuthStep("authenticated");
      toast({
        title: "Access granted",
        description: "Welcome to the admin panel.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid verification code";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchSubscribers = async () => {
    setIsLoadingSubscribers(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-subscribers");
      
      if (error) throw error;
      
      setSubscribers(data.subscribers || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch subscribers";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingSubscribers(false);
    }
  };

  useEffect(() => {
    if (authStep === "authenticated") {
      fetchSubscribers();
    }
  }, [authStep]);

  const handlePlanChange = async () => {
    if (!selectedUser || !newPlan) return;

    setIsUpdating(true);
    try {
      const action = selectedUser.subscriptionId ? "change_plan" : "create";
      const { error } = await supabase.functions.invoke("admin-manage-subscription", {
        body: {
          action,
          subscriptionId: selectedUser.subscriptionId,
          customerId: selectedUser.customerId,
          userEmail: selectedUser.email,
          newPlan,
        },
      });

      if (error) throw error;

      toast({
        title: "Plan updated",
        description: `${selectedUser.email} is now on the ${newPlan} plan.`,
      });
      
      setDialogType(null);
      setSelectedUser(null);
      fetchSubscribers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update plan";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      const action = selectedUser.isBlocked ? "unblock" : "block";
      const { error } = await supabase.functions.invoke("admin-block-user", {
        body: {
          action,
          targetUserId: selectedUser.userId,
        },
      });

      if (error) throw error;

      toast({
        title: selectedUser.isBlocked ? "User unblocked" : "User blocked",
        description: `${selectedUser.email} has been ${selectedUser.isBlocked ? "unblocked" : "blocked"}.`,
      });
      
      setDialogType(null);
      setSelectedUser(null);
      fetchSubscribers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update user";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminSessionToken");
    sessionStorage.removeItem("adminSessionExpiry");
    setAuthStep("password");
    setPassword("");
    setOtpCode("");
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", {
        body: { targetUserId: selectedUser.userId },
      });

      if (error) throw error;

      toast({
        title: "User deleted",
        description: `${selectedUser.email} has been permanently deleted.`,
      });

      setDialogType(null);
      setSelectedUser(null);
      fetchSubscribers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Admin Access Required</CardTitle>
              <CardDescription>
                Please log in to your admin account first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate("/login")}>
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Password screen
  if (authStep === "password") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SEO title="Admin Access - CarWise" description="Admin panel access" />
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <Lock className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Admin Access</CardTitle>
              <CardDescription>
                Enter your admin password to continue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              />
              <Button 
                className="w-full" 
                onClick={handlePasswordSubmit}
                disabled={!password || isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // OTP screen
  if (authStep === "otp") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SEO title="Verify Access - CarWise" description="Admin panel verification" />
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle>Verify Your Identity</CardTitle>
              <CardDescription>
                Enter the 6-digit code sent to your email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={setOtpCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button 
                className="w-full" 
                onClick={handleOtpSubmit}
                disabled={otpCode.length !== 6 || isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Access"
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setAuthStep("password")}
              >
                Back
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title="Admin Dashboard - CarWise" description="Manage subscribers and users" />
      <Header />
      
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage subscribers and user accounts
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={fetchSubscribers}
                disabled={isLoadingSubscribers}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingSubscribers ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Subscribers ({subscribers.length})</CardTitle>
              <CardDescription>
                All registered users and their subscription status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSubscribers ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Join Date</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Bill</TableHead>
                        <TableHead>Next Bill</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscribers.map((sub) => (
                        <TableRow key={sub.userId} className={sub.isBlocked ? "bg-destructive/5" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sub.displayName || "No name"}</p>
                              <p className="text-sm text-muted-foreground">{sub.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(sub.joinDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              sub.plan === "Pro" ? "default" : 
                              sub.plan === "Standard" ? "secondary" : 
                              "outline"
                            }>
                              {sub.plan}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sub.isBlocked ? (
                              <Badge variant="destructive">Blocked</Badge>
                            ) : sub.status === "active" ? (
                              <Badge variant="outline" className="text-success border-success">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline">{sub.status || "N/A"}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {sub.lastBillDate 
                              ? format(new Date(sub.lastBillDate), "MMM d, yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {sub.nextBillDate 
                              ? format(new Date(sub.nextBillDate), "MMM d, yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUser(sub);
                                  setNewPlan(sub.plan);
                                  setDialogType("plan");
                                }}
                              >
                                Change Plan
                              </Button>
                              <Button
                                size="sm"
                                variant={sub.isBlocked ? "outline" : "destructive"}
                                onClick={() => {
                                  setSelectedUser(sub);
                                  setDialogType("block");
                                }}
                              >
                                {sub.isBlocked ? (
                                  <>
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Unblock
                                  </>
                                ) : (
                                  <>
                                    <Ban className="mr-1 h-3 w-3" />
                                    Block
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedUser(sub);
                                  setDialogType("delete");
                                }}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Change Plan Dialog */}
      <Dialog open={dialogType === "plan"} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Update the plan for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Free">Free</SelectItem>
                <SelectItem value="Standard">Standard ($9.99/mo)</SelectItem>
                <SelectItem value="Pro">Pro ($19.99/mo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Cancel
            </Button>
            <Button onClick={handlePlanChange} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Plan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block User Dialog */}
      <Dialog open={dialogType === "block"} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedUser?.isBlocked ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              {selectedUser?.isBlocked ? "Unblock User" : "Block User"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.isBlocked 
                ? `Are you sure you want to unblock ${selectedUser?.email}? They will be able to access their account again.`
                : `Are you sure you want to block ${selectedUser?.email}? They will no longer be able to log in.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Cancel
            </Button>
            <Button
              variant={selectedUser?.isBlocked ? "default" : "destructive"}
              onClick={handleBlockUser}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : selectedUser?.isBlocked ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Unblock User
                </>
              ) : (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Block User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={dialogType === "delete"} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete User Permanently
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{selectedUser?.email}</strong>? This will remove all their data including reports, subscriptions, and account information. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
