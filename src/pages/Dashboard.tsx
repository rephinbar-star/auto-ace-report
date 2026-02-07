import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ReportCard } from "@/components/dashboard/ReportCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo/SEO";
import { Plus, Search, Filter, Car, FileText, TrendingUp, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { Tables } from "@/integrations/supabase/types";

type VehicleReport = Tables<"vehicle_reports">;

function DashboardContent() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dealRatingFilter, setDealRatingFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Fetch vehicle reports
  const { data: reports, isLoading, error } = useQuery({
    queryKey: ["vehicle-reports", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as VehicleReport[];
    },
    enabled: !!user,
  });

  // Filter and sort reports
  const filteredReports = useMemo(() => {
    if (!reports) return [];

    let filtered = reports;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (report) =>
          report.make.toLowerCase().includes(query) ||
          report.model.toLowerCase().includes(query) ||
          report.year.toString().includes(query) ||
          report.vin?.toLowerCase().includes(query) ||
          report.trim?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((report) => report.status === statusFilter);
    }

    // Deal rating filter
    if (dealRatingFilter !== "all") {
      filtered = filtered.filter((report) => report.deal_rating === dealRatingFilter);
    }

    // Sort
    switch (sortBy) {
      case "oldest":
        filtered = [...filtered].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        break;
      case "price-high":
        filtered = [...filtered].sort((a, b) => Number(b.asking_price) - Number(a.asking_price));
        break;
      case "price-low":
        filtered = [...filtered].sort((a, b) => Number(a.asking_price) - Number(b.asking_price));
        break;
      case "mileage-low":
        filtered = [...filtered].sort((a, b) => a.mileage - b.mileage);
        break;
      default: // newest
        filtered = [...filtered].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return filtered;
  }, [reports, searchQuery, statusFilter, dealRatingFilter, sortBy]);

  // Stats
  const stats = useMemo(() => {
    if (!reports) return { total: 0, complete: 0, excellent: 0 };
    return {
      total: reports.length,
      complete: reports.filter((r) => r.status === "complete").length,
      excellent: reports.filter((r) => r.deal_rating === "excellent" || r.deal_rating === "good").length,
    };
  }, [reports]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* Page header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">My Vehicle Reports</h1>
              <p className="text-muted-foreground mt-1">
                Track and manage your vehicle analyses
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/analyze">
                <Plus className="h-5 w-5 mr-2" />
                New Analysis
              </Link>
            </Button>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-card border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Reports</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-card border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Car className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.complete}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-card border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.excellent}</p>
                  <p className="text-sm text-muted-foreground">Good Deals Found</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and filters */}
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by make, model, year, or VIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="analyzing">Analyzing</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dealRatingFilter} onValueChange={setDealRatingFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Deal Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="overpriced">Overpriced</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="mileage-low">Mileage: Low to High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          {!isLoading && reports && (
            <p className="text-sm text-muted-foreground mb-4">
              Showing {filteredReports.length} of {reports.length} reports
            </p>
          )}

          {/* Reports grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-6 rounded-xl border bg-card">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-10 w-full mt-4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Reports</h3>
              <p className="text-muted-foreground mb-4">
                There was a problem loading your reports. Please try again.
              </p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Car className="h-16 w-16 text-muted-foreground/50 mb-4" />
              {reports && reports.length > 0 ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">No Matching Reports</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search or filters
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setDealRatingFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">No Reports Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start analyzing vehicles to see your reports here
                  </p>
                  <Button asChild>
                    <Link to="/analyze">
                      <Plus className="h-4 w-4 mr-2" />
                      Start Your First Analysis
                    </Link>
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReports.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <SEO
        title="Dashboard - CarWise"
        description="View and manage your vehicle analysis reports"
      />
      <DashboardContent />
    </ProtectedRoute>
  );
}
