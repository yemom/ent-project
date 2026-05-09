"use client";

import { LayoutDashboard, Package, User, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { logout } from "@/services/api/auth";

interface PharmacistLayoutProps {
  children: React.ReactNode;
}

export function PharmacistLayout({ children }: PharmacistLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const navItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/pharmacist/dashboard",
    },
    {
      icon: Package,
      label: "Orders",
      href: "/pharmacist/orders",
    },
    {
      icon: User,
      label: "Profile",
      href: "/pharmacist/profile",
    },
  ];

  return (
    <div className="flex gap-6 min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-muted/30 p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold">CliniCel</h2>
          <p className="text-sm text-muted-foreground">Pharmacy Suite</p>
        </div>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-teal-100 text-teal-700 font-semibold"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 pb-20">{children}</main>
    </div>
  );
}
