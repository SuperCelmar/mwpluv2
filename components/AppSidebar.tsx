"use client";

import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink, Logo, SidebarToggle, RecentConversations } from "@/components/ui/sidebar";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, MessageSquare, Folder, User, Settings, LogOut, Sun, Moon, Monitor } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Hide logo on chat conversation pages
  const isChatConversationPage = pathname?.startsWith('/chat/') && pathname !== '/chat' && pathname !== '/chats';

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

  return (
    <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {open && !isChatConversationPage ? <Logo /> : <SidebarToggle />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
            <RecentConversations />
          </div>
          <div className="mt-auto">
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
          </div>
        </SidebarBody>
      </Sidebar>
  );
}

