import { Fragment, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Car, Lightbulb, Menu, X, Sun, Moon, Monitor, User, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import {
  SOLUTION_LINKS,
  SOLUTION_STATUS_LABEL,
  getNavContext,
  isSolutionActive,
  type SolutionStatus,
} from "@/lib/nav-context";

const analysisNavigation = [
  { name: "Home", href: "/" },
  { name: "Marketplace", href: "/marketplace", accent: true },
  { name: "Sample Reports", href: "/sample-report" },
  { name: "How It Works", href: "/how-it-works" },
  { name: "Pricing", href: "/pricing" },
];

const solutionsNavigation = [
  { name: "Home", href: "/" },
  { name: "Pricing", href: "/pricing" },
];

function StatusBadge({ status }: { status: SolutionStatus }) {
  if (status === "live") return null;
  const isBeta = status === "beta";
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1",
        isBeta
          ? "bg-blue-500/15 text-blue-500 ring-blue-500/30"
          : "bg-muted text-muted-foreground ring-border"
      )}
    >
      {isBeta ? "Beta" : "Soon"}
    </span>
  );
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();
  const navContext = getNavContext(location.pathname);
  const isSolutionsContext = navContext === "solutions";
  const navigation = isSolutionsContext ? solutionsNavigation : analysisNavigation;
  const activeSolution = SOLUTION_LINKS.find((s) =>
    isSolutionActive(s.href, location.pathname)
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "U";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex items-end gap-0">
            <span className="text-xl font-bold">CarWise</span>
            <Lightbulb className="h-5 w-5 text-yellow-400 fill-yellow-400 -ml-0.5 mb-0.5 animate-glow-pulse" />
            <a href="https://github.com/rephinbar-star/auto-ace-report" target="_blank" rel="noopener noreferrer" className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-500 ring-1 ring-blue-500/30 mb-0.5 animate-[pulse_3s_ease-in-out_infinite] hover:bg-blue-500/25 transition-colors" onClick={(e) => e.stopPropagation()}>Beta</a>
          </div>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-8 md:flex">
          {navigation.map((item) => (
            <Fragment key={item.name}>
              <Link
                to={item.href}
                className={cn(
                  "text-sm font-medium transition-colors relative flex items-center gap-1",
                  (item as any).accent
                    ? "text-blue-500 font-semibold animate-[pulse_2.5s_ease-in-out_infinite] hover:text-blue-400"
                    : location.pathname === item.href
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                )}
                aria-current={location.pathname === item.href ? "page" : undefined}
              >
                {item.name}
                {(item as any).accent && (
                  <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-500 ring-1 ring-blue-500/30">
                    New
                  </span>
                )}
              </Link>

              {/* Solutions dropdown sits between Home and Pricing */}
              {isSolutionsContext && item.href === "/" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
                        activeSolution ? "text-primary" : "text-muted-foreground hover:text-primary"
                      )}
                    >
                      {activeSolution ? activeSolution.name : "Solutions"}
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    {SOLUTION_LINKS.map((s) => (
                      <DropdownMenuItem key={s.href} asChild>
                        <Link
                          to={s.href}
                          className="cursor-pointer flex-col items-start gap-0.5"
                          aria-current={
                            isSolutionActive(s.href, location.pathname) ? "page" : undefined
                          }
                        >
                          <span className="flex w-full items-center gap-2">
                            <span
                              className={cn(
                                "text-sm font-medium",
                                isSolutionActive(s.href, location.pathname) && "text-primary"
                              )}
                            >
                              {s.name}
                            </span>
                            <StatusBadge status={s.status} />
                            <span className="sr-only">{SOLUTION_STATUS_LABEL[s.status]}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">{s.description}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Fragment>
          ))}
        </div>


        {/* Desktop CTA */}
        <div className="hidden items-center gap-2 md:flex">
          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAuthenticated ? (
            <>
              <Button asChild variant="ghost">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 pl-2 pr-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">Signed in</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">Log In</Link>
              </Button>
              {!isSolutionsContext && (
                <Button asChild>
                  <Link to="/analyze">Start Analysis</Link>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          {/* Mobile theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile user dropdown when authenticated */}
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Signed in</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="sr-only">Open main menu</span>
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t bg-background md:hidden">
          <div className="container mx-auto space-y-1 px-4 py-4">
            {isAuthenticated && (
              <Link
                to="/dashboard"
                className={cn(
                  "block rounded-lg px-3 py-2 text-base font-medium transition-colors",
                  location.pathname === "/dashboard"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
            )}
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-base font-medium transition-colors",
                  (item as any).accent
                    ? "text-blue-500 font-semibold"
                    : location.pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
                {(item as any).accent && (
                  <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-500 ring-1 ring-blue-500/30">
                    New
                  </span>
                )}
              </Link>
            ))}

            {isSolutionsContext && (
              <div className="pt-2">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Solutions
                </p>
                {SOLUTION_LINKS.map((s) => (
                  <Link
                    key={s.href}
                    to={s.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium transition-colors",
                      isSolutionActive(s.href, location.pathname)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    aria-current={
                      isSolutionActive(s.href, location.pathname) ? "page" : undefined
                    }
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {s.name}
                    <StatusBadge status={s.status} />
                    <span className="sr-only">{SOLUTION_STATUS_LABEL[s.status]}</span>
                  </Link>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-4">
              {!isAuthenticated && (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    Log In
                  </Link>
                </Button>
              )}
              {!isSolutionsContext && (
                <Button asChild className="w-full">
                  <Link to="/analyze" onClick={() => setMobileMenuOpen(false)}>
                    Start Analysis
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}