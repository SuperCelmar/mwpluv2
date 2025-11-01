'use client';

import { useState } from 'react';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface ProjectActionsProps {
  onRename: () => void;
  onDelete: () => void;
}

export function ProjectActions({ onRename, onDelete }: ProjectActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onRename} className="cursor-pointer">
          <Edit2 className="mr-2 h-4 w-4" />
          Renommer le projet
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />
          Supprimer le projet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
