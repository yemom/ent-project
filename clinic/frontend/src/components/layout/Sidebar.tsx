"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  X,
  LucideIcon,
  ChevronRight,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { getNavigationForRole, NavGroup, NavChild } from "@/config/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useNavBadges } from "@/hooks/use-nav-badges";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SidebarProps {
  role?: string | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const STORAGE_EXPANDED_KEY = "cms_sidebar_expanded_groups";
const EXACT_MATCH_ROOTS = new Set([
  "/admin",
  "/doctor",
  "/patient",
  "/cashier",
  "/laboratory",
  "/hospital",
  "/nurse",
  "/reception",
  "/pharmacist",
]);

function isRouteActive(pathname: string, href: string): boolean {
  if (EXACT_MATCH_ROOTS.has(href)) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  role,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const userRole = role || user?.role || "SUPER_ADMIN";
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const clearSession = useAuthStore((state) => state.clearSession);
  const badges = useNavBadges();

  const navGroups = useMemo(() => {
    const rawGroups = getNavigationForRole(userRole);
    return rawGroups
      .map((group) => {
        if (group.permission && !hasPermission(group.permission)) {
          return null;
        }
        if (group.children) {
          const filteredChildren = group.children.filter(
            (child) => !child.permission || hasPermission(child.permission),
          );
          if (filteredChildren.length === 0) return null;
          return { ...group, children: filteredChildren };
        }
        return group;
      })
      .filter((g): g is NavGroup => g !== null);
  }, [userRole, hasPermission]);

  // Load initial expanded state from localStorage
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_EXPANDED_KEY);
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    },
  );

  // Save to localStorage whenever expandedGroups changes
  const saveExpandedGroups = useCallback(
    (newExpanded: Record<string, boolean>) => {
      setExpandedGroups(newExpanded);
      try {
        localStorage.setItem(STORAGE_EXPANDED_KEY, JSON.stringify(newExpanded));
      } catch (_err) {
        void _err;
      }
    },
    [],
  );

  // Auto-expand group containing the active page
  useEffect(() => {
    const activeGroup = navGroups.find(
      (group) =>
        group.children &&
        group.children.some((child) => isRouteActive(pathname, child.href)),
    );
    if (activeGroup && !expandedGroups[activeGroup.label]) {
      setExpandedGroups((prev) => {
        const next = { ...prev, [activeGroup.label]: true };
        try {
          localStorage.setItem(STORAGE_EXPANDED_KEY, JSON.stringify(next));
        } catch (_err) {
          void _err;
        }
        return next;
      });
    }
  }, [pathname, navGroups]);

  const toggleGroup = (label: string) => {
    saveExpandedGroups({
      ...expandedGroups,
      [label]: !expandedGroups[label],
    });
  };

  const handleLogout = () => {
    clearSession();
    router.replace("/login");
  };

  const renderContent = () => (
    <div className="flex h-full flex-col bg-[#0b1220] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#1e293b]/70 px-4">
        <Link
          href={navGroups[0]?.href || "/"}
          className="flex items-center gap-3 font-semibold text-white tracking-wide transition hover:opacity-90"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20">
            C
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold text-white tracking-tight">
                Clinic Care
              </span>
              <span className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">
                Enterprise CMS
              </span>
            </div>
          )}
        </Link>
        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav List - Own Scrollbar */}
      <nav
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
      >
        {navGroups.map((group) => {
          const Icon = group.icon;
          const hasChildren = Boolean(
            group.children && group.children.length > 0,
          );
          const isGroupActive = Boolean(
            group.children?.some((child) =>
              isRouteActive(pathname, child.href),
            ),
          );
          const isSingleActive = group.href
            ? isRouteActive(pathname, group.href)
            : false;
          const isExpanded = Boolean(expandedGroups[group.label]);

          if (collapsed) {
            // Icon rail mode
            const targetHref = group.href || group.children?.[0]?.href || "#";
            const isActive = isSingleActive || isGroupActive;
            return (
              <TooltipProvider key={group.label} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={targetHref}
                      className={cn(
                        "flex h-11 w-full items-center justify-center rounded-xl transition duration-150",
                        isActive
                          ? "bg-[#2563eb] text-white shadow-sm"
                          : "text-slate-400 hover:bg-slate-800/80 hover:text-white",
                      )}
                      aria-label={group.label}
                    >
                      <Icon className="h-5 w-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-slate-900 text-white border-slate-700"
                  >
                    {group.label}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          if (!hasChildren && group.href) {
            // Single Link (Dashboard, Audit Logs, Settings)
            const badgeCount = group.badgeKey
              ? badges[group.badgeKey]
              : undefined;
            return (
              <SidebarItem
                key={group.label}
                href={group.href}
                label={group.label}
                icon={Icon}
                active={isSingleActive}
                badgeCount={badgeCount}
                onClick={onCloseMobile}
              />
            );
          }

          // Collapsible Group
          const groupBadgeCount = group.children?.reduce((acc, child) => {
            if (child.badgeKey && badges[child.badgeKey]) {
              return acc + (badges[child.badgeKey] || 0);
            }
            return acc;
          }, 0);

          return (
            <SidebarGroup
              key={group.label}
              label={group.label}
              icon={Icon}
              isExpanded={isExpanded}
              onToggle={() => toggleGroup(group.label)}
              isGroupActive={isGroupActive}
              badgeCount={groupBadgeCount}
            >
              {group.children?.map((child) => {
                const childActive = isRouteActive(pathname, child.href);
                const childBadgeCount = child.badgeKey
                  ? badges[child.badgeKey]
                  : undefined;
                return (
                  <SidebarSubItem
                    key={child.href}
                    href={child.href}
                    label={child.label}
                    active={childActive}
                    badgeCount={childBadgeCount}
                    onClick={onCloseMobile}
                  />
                );
              })}
            </SidebarGroup>
          );
        })}
      </nav>

      {/* Pinned User Card */}
      <UserCard
        collapsed={collapsed}
        fullName={user?.fullName || "Super Admin"}
        role={userRole}
        onLogout={handleLogout}
      />
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col fixed inset-y-0 left-0 z-30 border-r border-[#66944b] transition-all duration-200",
          collapsed ? "w-20" : "w-64",
        )}
      >
        {renderContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Content */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-[#66944b] shadow-2xl transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {renderContent()}
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badgeCount?: number;
  onClick?: () => void;
}

function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
  badgeCount,
  onClick,
}: SidebarItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition duration-150",
        active
          ? "bg-[#2563eb] text-white shadow-sm"
          : "text-slate-300 hover:bg-slate-800/70 hover:text-white",
      )}
    >
      <div className="flex items-center gap-3 truncate">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-white" : "text-slate-400 group-hover:text-white",
          )}
        />
        <span className="truncate">{label}</span>
      </div>
      {typeof badgeCount === "number" && badgeCount > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
            active ? "bg-white text-blue-700" : "bg-blue-600 text-white",
          )}
        >
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

interface SidebarGroupProps {
  label: string;
  icon: LucideIcon;
  isExpanded: boolean;
  onToggle: () => void;
  isGroupActive: boolean;
  badgeCount?: number;
  children: React.ReactNode;
}

function SidebarGroup({
  label,
  icon: Icon,
  isExpanded,
  onToggle,
  isGroupActive,
  badgeCount,
  children,
}: SidebarGroupProps) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={cn(
          "group flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition duration-150",
          isGroupActive
            ? "text-white bg-slate-800/40"
            : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
        )}
      >
        <div className="flex items-center gap-3 truncate">
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              isGroupActive
                ? "text-blue-400"
                : "text-slate-400 group-hover:text-white",
            )}
          />
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {typeof badgeCount === "number" && badgeCount > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
              {badgeCount}
            </span>
          )}
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-white",
              isExpanded && "rotate-90",
            )}
          />
        </div>
      </button>

      {/* Indented Sub-items */}
      {isExpanded && (
        <div className="pl-6 pr-1 space-y-1 py-1 transition-all">
          {children}
        </div>
      )}
    </div>
  );
}

interface SidebarSubItemProps {
  href: string;
  label: string;
  active: boolean;
  badgeCount?: number;
  onClick?: () => void;
}

function SidebarSubItem({
  href,
  label,
  active,
  badgeCount,
  onClick,
}: SidebarSubItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition duration-150",
        active
          ? "bg-[#2563eb] text-white shadow-sm"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-white",
      )}
    >
      <span className="truncate">{label}</span>
      {typeof badgeCount === "number" && badgeCount > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[11px] font-semibold",
            active ? "bg-white text-blue-700" : "bg-blue-600 text-white",
          )}
        >
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

interface UserCardProps {
  collapsed: boolean;
  fullName: string;
  role: string;
  onLogout: () => void;
}

function UserCard({ collapsed, fullName, role, onLogout }: UserCardProps) {
  const initial = (fullName.trim().charAt(0) || "U").toUpperCase();
  const formattedRole = role
    .split("_")
    .map((p) => p.toUpperCase())
    .join("_");

  if (collapsed) {
    return (
      <div className="border-t border-[#1e293b] p-3 flex justify-center">
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm shadow hover:bg-red-600 transition"
        >
          {initial}
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-[#1e293b] p-3">
      <div className="flex items-center justify-between rounded-xl p-2 bg-[#0d1628]/60 hover:bg-[#0d1628] transition">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm shadow-sm">
            {initial}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold text-white leading-tight">
              {fullName}
            </span>
            <span className="truncate text-[11px] font-medium text-slate-400 tracking-wider">
              {formattedRole}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Sign out"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-red-400 transition"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
