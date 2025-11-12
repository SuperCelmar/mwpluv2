"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { supabase, V2Conversation } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter, usePathname } from "next/navigation";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();

  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col bg-neutral-100 dark:bg-neutral-800 w-[300px] flex-shrink-0",
        className
      )}
      animate={{
        width: animate ? (open ? "300px" : "60px") : "300px",
      }}
      transition={{
        duration: 0.3,
        ease: "easeInOut",
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();

  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-neutral-100 dark:bg-neutral-800 w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-neutral-800 dark:text-neutral-200 cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200 cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();

  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-2 group/sidebar py-2 relative",
        className
      )}
      {...props}
    >
      <motion.div
        className={cn(
          "flex items-center justify-center",
          open ? "w-auto" : "w-full"
        )}
        animate={{
          x: 0,
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
      >
        {link.icon}
      </motion.div>
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
            className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0 overflow-hidden"
          >
            {link.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
};

// Recent Conversations Component
export const RecentConversations = () => {
  const { open } = useSidebar();
  const [conversations, setConversations] = useState<V2Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open]);

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('v2_conversations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (data) {
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentConversationId = () => {
    const match = pathname?.match(/\/chat\/([^\/]+)/);
    return match ? match[1] : null;
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const currentConversationId = getCurrentConversationId();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
          className="mt-4 flex flex-col gap-2 overflow-y-auto flex-1"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-2 text-neutral-500 dark:text-neutral-400">
            Récents
          </h2>
          <div className="space-y-1">
            {loading ? (
              <div className="text-sm text-center py-4 text-neutral-500 dark:text-neutral-400">
                Chargement...
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-sm text-center py-4 text-neutral-500 dark:text-neutral-400">
                Aucune conversation
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive = currentConversationId === conversation.id;
                const convTitle = conversation.title || 
                  conversation.context_metadata?.initial_address || 
                  'Conversation';
                const lastActivity = conversation.last_message_at || conversation.created_at;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => handleConversationClick(conversation.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg transition-all duration-150 text-sm",
                      isActive 
                        ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100" 
                        : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      <p className="font-medium truncate text-xs">
                        {convTitle}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDistanceToNow(new Date(lastActivity), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Logo Components
export const Logo = () => {
  const { open, setOpen } = useSidebar();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOpen(false)}
        className="font-normal flex items-center justify-center text-sm text-black dark:text-white py-1 relative z-20 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors p-1"
        aria-label="Close sidebar"
      >
        <Menu className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
      </button>
      <Link
        href="/"
        className="font-normal flex items-center text-sm text-black dark:text-white py-1 relative z-20"
      >
        <Image
          src="/MWPLU.svg"
          alt="MWPLU"
          width={120}
          height={40}
          className="h-8 w-auto"
          priority
        />
      </Link>
    </div>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      href="/"
      className="font-normal flex items-center justify-center text-sm text-black dark:text-white py-1 relative z-20 w-full"
    >
      <Image
        src="/MWPLU.svg"
        alt="MWPLU"
        width={40}
        height={40}
        className="h-8 w-auto"
        priority
      />
    </Link>
  );
};

// Sidebar Toggle Component
export const SidebarToggle = () => {
  const { open, setOpen } = useSidebar();

  return (
    <button
      onClick={() => setOpen(!open)}
      className="font-normal flex items-center justify-center text-sm text-black dark:text-white py-1 relative z-20 w-full cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
      aria-label="Toggle sidebar"
    >
      <Menu className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
    </button>
  );
};

