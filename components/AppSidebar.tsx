"use client";

import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink, Logo, LogoIcon, RecentConversations } from "@/components/ui/sidebar";
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
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const collapseTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const dropdownOpenRef = React.useRef(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
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

  // Handle sidebar collapse with delay and dropdown check
  const handleMouseLeave = () => {
    // Clear any existing timeout
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    
    // Only collapse if dropdown is not open
    if (!dropdownOpenRef.current) {
      collapseTimeoutRef.current = setTimeout(() => {
        if (!dropdownOpenRef.current) {
          setOpen(false);
        }
      }, 200); // 200ms delay to allow moving to dropdown menu
    }
  };

  // Handle sidebar expand
  const handleMouseEnter = () => {
    // Clear any pending collapse
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    setOpen(true);
  };

  // Keep sidebar open when dropdown opens
  const handleDropdownOpenChange = (isOpen: boolean) => {
    dropdownOpenRef.current = isOpen;
    setDropdownOpen(isOpen);
    if (isOpen) {
      // Clear any pending collapse
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
      // Ensure sidebar stays open
      setOpen(true);
    } else {
      // When dropdown closes, allow sidebar to collapse after a delay
      // This gives time for mouse to return to sidebar
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
      collapseTimeoutRef.current = setTimeout(() => {
        // Check if dropdown is still closed
        if (!dropdownOpenRef.current) {
          setOpen(false);
        }
      }, 200);
    }
  };

  return (
    <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody 
          className="justify-between gap-10"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
            <RecentConversations />
          </div>
          <div className="mt-auto">
            <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "w-full flex items-center gap-2 py-2 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors",
                  open ? "justify-start" : "justify-center"
                )}>
                  <Avatar className="h-5 w-5 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {open && (
                    <span className="text-sm font-medium truncate">
                      {user?.email?.split('@')[0] || 'Utilisateur'}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="w-56">
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
                <DropdownMenuLabel>Thème</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 h-4 w-4" />
                  Clair
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 h-4 w-4" />
                  Sombre
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="mr-2 h-4 w-4" />
                  Système
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarBody>
      </Sidebar>
  );
}

