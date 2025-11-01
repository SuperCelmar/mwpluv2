/*
  # Create PLU Analysis Application Schema

  ## Overview
  This migration sets up the core database structure for the French architect PLU analysis application.
  It creates tables for managing architectural projects and their associated chat messages.

  ## New Tables
  
  ### `projects`
  Stores architectural projects created by users
  - `id` (uuid, primary key): Unique project identifier
  - `user_id` (uuid, foreign key): Reference to authenticated user
  - `name` (text, required): Project name
  - `address` (text, optional): Project street address
  - `municipality` (text, optional): City/municipality name
  - `zone` (text, optional): PLU zone classification (e.g., UA, UB)
  - `project_type` (text, optional): Type of project (construction, extension, renovation)
  - `created_at` (timestamptz): Project creation timestamp
  - `updated_at` (timestamptz): Last modification timestamp

  ### `messages`
  Stores chat conversation messages for each project
  - `id` (uuid, primary key): Unique message identifier
  - `project_id` (uuid, foreign key): Reference to parent project
  - `role` (text, required): Message sender role (user or assistant)
  - `content` (text, required): Message text content
  - `citations` (jsonb, optional): JSON array of document citations
  - `created_at` (timestamptz): Message creation timestamp

  ## Security
  
  ### Row Level Security (RLS)
  Both tables have RLS enabled to ensure users can only access their own data
  
  ### Policies
  **Projects table:**
  - Users can view only their own projects
  - Users can insert projects with their own user_id
  - Users can update only their own projects
  - Users can delete only their own projects
  
  **Messages table:**
  - Users can view messages only from their own projects
  - Users can insert messages only to their own projects
  
  ## Important Notes
  - All foreign key relationships use CASCADE DELETE to maintain referential integrity
  - Project types are constrained to three valid values for data consistency
  - Message roles are constrained to 'user' or 'assistant'
  - Updated_at timestamp enables sorting projects by most recent activity
*/

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  address text,
  municipality text,
  zone text,
  project_type text CHECK (project_type IN ('construction', 'extension', 'renovation')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  role text CHECK (role IN ('user', 'assistant')) NOT NULL,
  content text NOT NULL,
  citations jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view own projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages from own projects"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = messages.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to own projects"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = messages.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);