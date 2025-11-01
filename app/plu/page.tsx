'use client';

import dynamic from 'next/dynamic';

const LeftSidebar = dynamic(() => import('@/components/plu/LeftSidebar').then(mod => ({ default: mod.LeftSidebar })), { ssr: false });
const ChatArea = dynamic(() => import('@/components/plu/ChatArea').then(mod => ({ default: mod.ChatArea })), { ssr: false });
const RightPanel = dynamic(() => import('@/components/plu/RightPanel').then(mod => ({ default: mod.RightPanel })), { ssr: false });

export default function PLUChatPage() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
      <LeftSidebar />
      <ChatArea />
      <RightPanel />
    </div>
  );
}
