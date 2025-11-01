'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { AddressInput } from '@/components/AddressInput';
import { NewProjectModal } from '@/components/NewProjectModal';
import { ProjectActions } from '@/components/ProjectActions';
import { DeleteProjectDialog } from '@/components/DeleteProjectDialog';
import { supabase, Project, Message } from '@/lib/supabase';
import { AddressSuggestion } from '@/lib/address-api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

export default function ProjectPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    checkUser();
  }, [params.id]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    fetchProject();
    fetchProjects();
    fetchMessages();
  };

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        router.push('/dashboard');
        return;
      }

      setProject(data);
    } catch (error) {
      console.error('Error fetching project:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (data) setProjects(data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('project_id', params.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleAddressSelect = async (address: AddressSuggestion) => {
    setSending(true);
    try {
      const fullAddress = address.properties.label;
      const municipality = address.properties.city;

      await supabase
        .from('projects')
        .update({
          address: fullAddress,
          municipality,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id);

      setProject((prev) => prev ? { ...prev, address: fullAddress, municipality } : null);

      const { data: userMessage, error: userError } = await supabase
        .from('messages')
        .insert({
          project_id: params.id,
          role: 'user',
          content: fullAddress,
        })
        .select()
        .single();

      if (userError) throw userError;

      if (userMessage) {
        setMessages((prev) => [...prev, userMessage]);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: fullAddress,
          projectId: params.id,
          address: fullAddress,
          isInitialAnalysis: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const { message: aiResponse } = await response.json();

      const { data: assistantMessage, error: assistantError } = await supabase
        .from('messages')
        .insert({
          project_id: params.id,
          role: 'assistant',
          content: aiResponse,
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      if (assistantMessage) {
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error saving address:', error);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    setSending(true);
    try {
      const { data: userMessage, error: userError } = await supabase
        .from('messages')
        .insert({
          project_id: params.id,
          role: 'user',
          content,
        })
        .select()
        .single();

      if (userError) throw userError;

      if (userMessage) {
        setMessages((prev) => [...prev, userMessage]);
      }

      await supabase
        .from('projects')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', params.id);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          projectId: params.id,
          address: project?.address,
          isInitialAnalysis: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to get AI response');

      const { message: aiResponse } = await response.json();

      const { data: assistantMessage, error: assistantError } = await supabase
        .from('messages')
        .insert({
          project_id: params.id,
          role: 'assistant',
          content: aiResponse,
        })
        .select()
        .single();

      if (assistantError) throw assistantError;

      if (assistantMessage) {
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleRename = () => {
    setNewName(project?.name || '');
    setIsRenaming(true);
  };

  const handleSaveRename = async () => {
    if (!newName.trim() || newName === project?.name) {
      setIsRenaming(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: newName.trim() })
        .eq('id', params.id);

      if (error) throw error;

      setProject((prev) => prev ? { ...prev, name: newName.trim() } : null);
      setIsRenaming(false);
    } catch (error) {
      console.error('Error renaming project:', error);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', params.id);

      if (error) throw error;

      router.push('/dashboard');
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <div className="w-[280px] border-r bg-gray-50 animate-pulse" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <ChatSidebar
        projects={projects}
        currentProjectId={params.id}
        onNewProject={() => setShowNewModal(true)}
      />
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {isRenaming ? (
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={handleSaveRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                  autoFocus
                  className="text-xl font-semibold"
                />
              ) : (
                <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
              )}
              {project.address && (
                <p className="text-sm text-gray-500 mt-1">{project.address}</p>
              )}
            </div>
            <ProjectActions onRename={handleRename} onDelete={() => setShowDeleteDialog(true)} />
          </div>
        </header>

        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
              <MessageSquare className="h-16 w-16 text-gray-300 mb-6" />
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                Quelle est l'adresse de votre projet ?
              </h2>
              <p className="text-gray-500 max-w-md mb-8">
                Commencez par indiquer l'adresse de votre projet pour obtenir une analyse PLU détaillée.
              </p>
              <AddressInput onAddressSelect={handleAddressSelect} disabled={sending} />
            </div>
          ) : (
            <div className="divide-y">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {sending && (
                <div className="flex gap-3 py-4 px-6 bg-white">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-200">
                    <MessageSquare className="h-5 w-5 text-gray-700 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-500 italic">L'assistant réfléchit...</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {messages.length > 0 && (
          <ChatInput
            onSend={handleSendMessage}
            disabled={sending}
            placeholder="Posez votre question..."
          />
        )}
      </div>
      <NewProjectModal open={showNewModal} onOpenChange={setShowNewModal} />
      <DeleteProjectDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        projectName={project.name}
      />
    </div>
  );
}
