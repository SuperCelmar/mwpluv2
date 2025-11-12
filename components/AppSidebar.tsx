"use client";

import React, { useState, useRef } from "react";
import { Sidebar, SidebarBody, SidebarLink, Logo, SidebarToggle, RecentConversations } from "@/components/ui/sidebar";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, MessageSquare, Folder, User, Settings, LogOut, Sun, Moon, Monitor } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { getSidebarState } from "@/lib/utils/sidebar-state";
import { Skeleton } from "@/components/ui/skeleton";

export function AppSidebar() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  // Always start with false to match server-side rendering (prevents hydration error)
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const isRestoringRef = useRef(true);
  const initialOpenStateRef = useRef<boolean | null>(null);

  // Load sidebar state from localStorage synchronously before first paint
  // This prevents animation when restoring state on refresh
  // Must run synchronously to set state before React paints
  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && initialOpenStateRef.current === null) {
      const savedState = localStorage.getItem('sidebar-open');
      const shouldBeOpen = savedState === 'true';
      initialOpenStateRef.current = shouldBeOpen;
      
      // Restore the state FIRST, synchronously before paint
      // This happens before React's first paint, so no visual flash
      if (shouldBeOpen) {
        setOpen(true);
      }
      
      // Mark that we've restored state, but delay it to ensure React renders skeleton first
      // We need to give React time to render with open=true and hasRestoredState=false
      // so that showSkeleton becomes true and the skeleton is displayed
      requestAnimationFrame(() => {
        // Wait for next frame to ensure open state has been applied
        requestAnimationFrame(() => {
          setHasRestoredState(true);
          
          // Mark restoration as complete after DOM updates
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Small additional delay to ensure React has flushed all state updates
              setTimeout(() => {
                isRestoringRef.current = false;
                setIsHydrated(true);
              }, 10);
            });
          });
        });
      });
    }
  }, []);

  // Save sidebar state to localStorage whenever it changes (but not during initial restoration)
  useEffect(() => {
    if (hasRestoredState && typeof window !== 'undefined') {
      localStorage.setItem('sidebar-open', open.toString());
    }
  }, [open, hasRestoredState]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const links = [
    {
      label: "Nouvelle recherche",
      href: "/",
      icon: (
        <Plus className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Chat",
      href: "/chats",
      icon: (
        <MessageSquare className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Projets",
      href: "/projects",
      icon: (
        <Folder className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  // Show skeleton when sidebar is open but content is still loading
  // Only show skeleton on client after hydration to prevent server/client mismatch
  // Show skeleton if: sidebar is open AND (user not loaded OR state not yet restored)
  // Also check if we're in the initial restoration phase
  const isLoading = !mounted || !hasRestoredState;
  const isInitialRestore = initialOpenStateRef.current !== null && !hasRestoredState;
  const showSkeleton = open && (isLoading || isInitialRestore) && typeof window !== 'undefined';

  return (
    <Sidebar open={open} setOpen={setOpen} animate={isHydrated && hasRestoredState && !isRestoringRef.current}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {showSkeleton ? (
              // Skeleton for open sidebar during loading
              <>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-7 w-32" />
                </div>
                <div className="mt-8 flex flex-col gap-2">
                  {[1, 2, 3].map((idx) => (
                    <div key={idx} className="flex items-center gap-2 py-2 px-1">
                      <Skeleton className="h-5 w-5 rounded" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <Skeleton className="h-3 w-16" />
                  <div className="space-y-1">
                    {[1, 2].map((idx) => (
                      <Skeleton key={idx} className="h-10 w-full rounded-lg" />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // Normal content
              <>
                {open ? <Logo /> : <SidebarToggle />}
                <div className="mt-8 flex flex-col gap-2">
                  {links.map((link, idx) => (
                    <SidebarLink key={idx} link={link} />
                  ))}
                </div>
                <RecentConversations />
              </>
            )}
          </div>
          <div className="mt-auto">
            {showSkeleton ? (
              // Skeleton for user dropdown when loading
              <div className="w-full flex items-center gap-2 py-2 px-1">
                <Skeleton className="h-5 w-5 rounded-full" />
                {open && <Skeleton className="h-4 w-24" />}
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "w-full flex items-center gap-2 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors justify-start px-1"
                  )}>
                    <div className="flex items-center justify-start flex-shrink-0 w-5">
                      <Avatar className="h-5 w-5 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                          {user?.email?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    {isHydrated ? (
                      <AnimatePresence>
                        {open && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{
                              duration: 0.2,
                              ease: "easeInOut",
                            }}
                            className="text-sm font-medium truncate overflow-hidden"
                          >
                            {user?.email?.split('@')[0] || 'Utilisateur'}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    ) : (
                      open && (
                        <span className="text-sm font-medium truncate overflow-hidden">
                          {user?.email?.split('@')[0] || 'Utilisateur'}
                        </span>
                      )
                    )}
                  </button>
                </DropdownMenuTrigger>
              <DropdownMenuContent 
                align={open ? "start" : "end"}
                side={open ? "top" : "right"}
                className={cn(open && "z-[100]")}
              >
                <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <DropdownMenuLabel className="mb-2">Thème</DropdownMenuLabel>
                  <div className="flex items-center gap-0 bg-secondary rounded-md p-1">
                    <button
                      onClick={() => setTheme('light')}
                      className={cn(
                        "flex items-center justify-center h-8 flex-1 rounded-sm transition-all",
                        mounted && theme === 'light'
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Light mode"
                    >
                      <Sun className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "flex items-center justify-center h-8 flex-1 rounded-sm transition-all",
                        mounted && theme === 'dark'
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Dark mode"
                    >
                      <Moon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={cn(
                        "flex items-center justify-center h-8 flex-1 rounded-sm transition-all",
                        mounted && theme === 'system'
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="System theme"
                    >
                      <Monitor className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </SidebarBody>
      </Sidebar>
  );
}

