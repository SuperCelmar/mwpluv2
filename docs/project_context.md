# MWPLU v2 - Product Context & UX Specification

## 🎯 Product Vision

**MWPLU v2** is a chat-first interface for French architects to instantly analyze urban planning documents (PLU) for any address in France. The app transforms complex 500-page regulatory documents into conversational, actionable insights in under 5 seconds.

---

## 👤 User Journey

### **Entry Point**
User lands on a clean interface with:
- Address input field (center of screen)
- Placeholder: *"Ex: 15 rue des Fustiers, Paris 75001"*
- "Commencer l'analyse" button (Start Analysis)
- Sidebar: Projects, Conversations, Settings, Profile

### **Goal**
User enters an address → Gets instant PLU analysis → Chats to ask specific questions about building regulations → Organizes work by projects

---

## 📁 Project Organization (NEW in v2)

### **Auto-Project Creation**
When a user enters their first address, the system automatically creates:
- **Project** (unnamed by default)
- **Conversation** (linked to the project)
- **Document references** (based on address)

**User can later**:
- Name the project ("Maison Bordeaux", "Extension Client Martin")
- Add description and project type (construction, extension, renovation, etc.)
- Add multiple conversations to the same project
- Star important projects
- Archive completed projects

### **Project Metadata (Informational)**
- **Main address**: Auto-filled from first search, editable
- **Main zone/city**: Calculated automatically, modifiable
- **Status**: `draft` → `active` (when user edits) → `completed` or `archived`

---

## 🎨 Interface Architecture

### **Layout Structure**
```
┌───────────────────────────────────────────────────────────────┐
│  SIDEBAR (collapsible)                MAIN CONTENT (full-screen)     │
│  ───────────────────────       ───────────────────────────    │
│  🏠 Nouvelle recherche         ┌─────────────┬──────────────┐ │
│                                │  CHAT       │  ARTIFACT    │ │
│  📁 MES PROJETS                │  PANEL      │  PANEL       │ │
│  ├─ 📁 Sans nom (draft)        │             │              │ │
│  │   └─ Conversation 1         │             │              │ │
│  ├─ 🏠 Maison Bordeaux         │             │              │ │
│  │   ├─ Analyse initiale       │             │              │ │
│  │   └─ Comparaison zones      │             │              │ │
│  └─ 🏢 Extension Lyon          └─────────────┴──────────────┘ │
│      └─ Faisabilité                                           │
│                                                               │
│  ⚙️  Paramètres                                               │
│  👤 Profil                                                    │
└───────────────────────────────────────────────────────────────┘
```

**Hierarchical organization:**
- Projects group related conversations
- Each project can have multiple conversations
- Each conversation can reference multiple documents (for zone comparisons)

**Two-panel system:**
- **Left Panel (40%)**: Chat interface
- **Right Panel (60%)**: Artifact display (document or map)

---

## 🔄 User Flow - Step by Step

### **Step 1: Address Submission**
```
┌──┐───────────────────────────────┐
│  │ Bienvenue sur MWPLU           │
│  │                               │
│  │ 📍 [Address input field]      │
│  │ Ex: 15 rue des Fustiers...    │
│  │                               │
│  │ [Commencer l'analyse]         │
│x │                               │ 
└──────────────────────────────────┘
```
x → User avatar profile

**User action**: Types address + clicks button

**System action**: 
- Validates address
- **Creates project automatically** (status: `draft`, name: null)
- Creates conversation linked to project
- Redirects to chat interface

**Result**: Project appears in sidebar as "📁 Sans nom"

---

### **Step 2: Project Header & Loading State (3-5 seconds)**
```
┌──┐──────────────────┬────────────────────┐
│  │ CHAT             │  ARTIFACT          │
│  │                  │                    │
│  │ ┌─────────────── │  📍 LOADING        │
│  │ │ 📁 Sans nom... │                    │
│  │ │ (click to edit)│  [Map appears with │
│  │ │ 📍 15 rue...   │   zone boundaries  │
│  │ └─────────────── │   highlighted]     │
│  │                  │                    │
│  │ 🤖 Assistant     │  "Récupération du  │
│  │ ⏳ Thinking...   │   document..."     │
│  │ (animated dots)  │                    │
│x │                  │                    │ 
└──────────────────────────────────────────┘
```
x → User avatar profile

**User sees**: 
- Project header with "Sans nom" (clickable to edit)
- Main address displayed (informational)
- Chat panel shows AI "thinking"
- Right panel displays interactive map with zone highlighted
- Loading message

**Behind the scenes**: System fetches zone data and searches for analysis

---

### **Step 3A: Analysis Available (Ideal Path - 95% of cases)**
```
┌──┐──────────────────┬────────────────────┐
│  │  CHAT            │  ARTIFACT          │
│  │                  │                    │
│  │  🤖 Assistant    │  📊 PLU ANALYSIS   │
│  │                  │  ───────────────── │
│  │  ✅ Analysis     │  Zone: UA          │
│  │  loaded for:     │  Ville: Grenoble   │
│  │                  │  ───────────────── │
│  │  📍 Rue Auguste  │                    │
│  │  Gaché, Grenoble │  📌 Résumé         │
│  │                  │  Zone urbaine      │
│  │  🗂️ Zone: UA     │  dense, hauteur    │
│  │  Zone urbaine    │  max 12m...        │
│  │  dense           │                    │
│  │                  │  📋 Contraintes    │
│  │  📊 Résumé:      │  • Hauteur: 12m    │
│  │  [2-3 sentence   │  • Emprise: 60%    │
│  │   summary]       │  • Recul: 5m       │
│  │                  │                    │
│  │  ⚠️ Points       │  ⚠️ Alertes        │
│  │  d'attention:    │  • Secteur         │
│  │  • Secteur       │    patrimonial     │
│  │    patrimonial   │                    │
│  │                  │  [📥 Télécharger]  │
│  │  💬 Je suis prêt │  [🔗 Doc officiel] │
│  │  à répondre!     │                    │
│  │                  │                    │
│  │  [Active input]  │  [📍 Voir carte]   │
│  │  "Ex: Hauteur    │  (toggle button)   │
│  │   maximale?"     │                    │
│x │                  │                    │ 
└──────────────────────────────────────────┘
```
x → User avatar profile

**User sees**:
- Welcome message from AI summarizing the zone
- Key constraints displayed in right panel
- Input field ACTIVE - ready to ask questions
- Toggle button to switch to map view

**User can**:
- Ask questions about specific regulations
- Download the analysis as PDF
- View the official source document
- Toggle to see the map
- Click on project name to edit details

---

### **Step 3B: Analysis NOT Available (5% of cases)**
```
┌──┐──────────────────┬────────────────────┐
│  │  CHAT            │  ARTIFACT          │
│  │                  │                    │
│  │  🤖 Assistant    │  📄 DOCUMENT       │
│  │                  │     OFFICIEL       │
│  │  ⚠️ Analyse non  │                    │
│  │  disponible pour │  [PDF Viewer]      │
│  │  cette zone.     │                    │
│  │                  │  Source:           │
│  │  📍 Zone: A      │  Géoportail        │
│  │  🏙️ Grenoble     │                    │
│  │                  │                    │
│  │  Le document     │                    │
│  │  officiel est    │                    │
│  │  affiché à       │                    │
│  │  droite.         │                    │
│  │                  │                    │
│  │  💡 Pour obtenir │                    │
│  │  une analyse IA  │                    │
│  │  et chater avec  │                    │
│  │  ce document:    │                    │
│  │                  │                    │
│  │  [🔒 S'abonner]  │  [📍 Voir carte]   │
│  │                  │                    │
│  │  [Input DISABLED]│                    │
│  │  "⚠️ Abonnement  │                    │
│  │   requis"        │                    │
│x │                  │                    │ 
└──────────────────────────────────────────┘
```
x → User avatar profile

**User sees**:
- Warning that AI analysis isn't available
- Official PDF document displayed in right panel
- Input field DISABLED with paywall message
- Call-to-action to subscribe

**User can**:
- View and scroll through official PDF
- Toggle to map view
- Click subscribe button

---

### **Step 4: Artifact Switching (Map ⟷ Document)**

**When user clicks "📍 Voir carte"**:
```
┌──┐──────────────────┬────────────────────┐
│  │  CHAT            │  ARTIFACT          │
│  │                  │                    │
│  │  🤖 Conversation │  📍 MAP            │
│  │  continues...    │                    │
│  │                  │  [Interactive map] │
│  │  💬 Question:    │                    │
│  │  "Quelle hauteur │  [Zone polygon     │
│  │  max?"           │   highlighted]     │
│  │                  │                    │
│  │  🤖 Answer:      │  [Address marker]  │
│  │  "12 mètres      │                    │
│  │  selon l'article │  [Zoom controls]   │
│  │  UB 10..."       │                    │
│  │                  │  [❌ Fermer]       │
│  │                  │                    │
│  │                  │  [📄 Document]     │
│  │                  │  (toggle button)   │
│x │                  │                    │ 
└──────────────────────────────────────────┘
```
x → User avatar profile

**Behavior**:
- Map **replaces** the document artifact (same space)
- Slide-in animation from right
- Map is fully interactive (zoom, pan, click)
- Toggle button changes to "📄 Document" to return
- Chat remains visible and active

**User can**:
- Continue chatting while viewing map
- Pan and zoom on the map
- Click back to document view anytime

---

### **Step 5: Active Conversation**
```
┌──┐──────────────────┬────────────────────┐
│  │  CHAT            │  ARTIFACT          │
│  │                  │                    │
│  │  💬 User:        │  📊 ANALYSIS       │
│  │  "Puis-je faire  │                    │
│  │  une extension   │  [Relevant section │
│  │  de 20m²?"       │   auto-scrolls     │
│  │                  │   into view]       │
│  │  🤖 Assistant:   │                    │
│  │  "Oui, sous      │  📋 Article UB 9   │
│  │  conditions.     │  ───────────────── │
│  │  L'emprise au    │  Emprise au sol:   │
│  │  sol maximale    │  60% maximum       │
│  │  est de 60%      │                    │
│  │  selon l'article │  Pour une parcelle │
│  │  UB 9..."        │  de 500m², cela    │
│  │                  │  représente...     │
│  │  💬 User:        │                    │
│  │  "Et la hauteur?"│                    │
│  │                  │                    │
│  │  🤖 Assistant:   │                    │
│  │  "12 mètres      │                    │
│  │  maximum selon   │                    │
│  │  UB 10. Voir     │                    │
│  │  section à       │                    │
│  │  droite →"       │                    │
│  │                  │                    │
│  │  [Active input]  │                    │
│x │                  │                    │ 
└──────────────────────────────────────────┘
```
x → User avatar profile

**Key interaction patterns**:
- When AI references a specific section, artifact auto-scrolls to show it
- AI can say "voir à droite →" to direct attention
- Conversational, not robotic
- Context maintained throughout conversation

---

### **Step 6: Multi-Zone Comparison (NEW)**

When user asks to compare multiple zones:

```
┌──┐──────────────────┬────────────────────┐
│  │  CHAT            │  ARTIFACT          │
│  │                  │                    │
│  │  💬 User:        │  📊 ZONE UA        │
│  │  "Compare avec   │  ───────────────── │
│  │  zone UB voisine"│  [Document UA]     │
│  │                  │                    │
│  │  🤖 Assistant:   │  [Switch toggle]   │
│  │  J'analyse les   │  📊 ZONE UB        │
│  │  2 zones...      │                    │
│  │                  │                    │
│  │  📍 Zone UA      │                    │
│  │  • Hauteur: 12m  │                    │
│  │  • Emprise: 60%  │                    │
│  │                  │                    │
│  │  📍 Zone UB      │                    │
│  │  • Hauteur: 9m   │                    │
│  │  • Emprise: 50%  │                    │
│  │                  │                    │
│  │  Votre parcelle  │                    │
│  │  est dans la zone│                    │
│  │  la plus         │                    │
│  │  permissive.     │                    │
│  │                  │                    │
│x │                  │                    │ 
└──────────────────────────────────────────┘
```
x → User avatar profile

**Behavior**:
- **Multiple documents** attached to conversation
- Artifact panel can switch between documents
- All documents remain accessible throughout conversation
- AI synthesizes comparison in chat

---

### **Step 7: Project Editing (NEW)**

User clicks on project name → Modal opens:

```
┌─────────────────────────────────────────┐
│  Modifier le projet                     │
│  ───────────────────────────────────    │
│                                         │
│  Nom du projet                          │
│  [Maison Bordeaux              ]        │
│                                         │
│  Type de projet                         │
│  [▼ Construction              ]        │
│                                         │
│  Description (optionnelle)              │
│  [Nouvelle construction...     ]        │
│  [                             ]        │
│                                         │
│  Adresse principale (info)              │
│  [15 rue de la Paix, Bordeaux  ]        │
│                                         │
│  [Annuler]          [Enregistrer]       │
└─────────────────────────────────────────┘
```

**After saving**:
- Project status changes from `draft` to `active`
- Name appears in sidebar: "🏠 Maison Bordeaux"
- Main address remains editable (informational only)

---

## 🗂️ Sidebar Organization

### **Project States**
```
📁 Sans nom (draft)           ← Newly created, not yet edited
🏠 Maison Bordeaux (active)   ← Named and in use
✅ Extension Lyon (completed) ← Marked as completed
📦 Rénovation Paris (archived)← Archived, less visible
```

### **Interaction Patterns**
- **Click project** → Expand/collapse conversations
- **Click conversation** → Open in main panel
- **Right-click project** → Context menu (rename, archive, delete)
- **Starred projects** → Appear at the top
- **Draft projects** → Gray text, italic "Sans nom"

---

## 🎭 Three Possible End States

### **State 1: Full Access (Subscribed User with Coverage)**
- ✅ AI analysis visible
- ✅ Chat fully active
- ✅ Can ask unlimited questions
- ✅ Can download analysis
- ✅ Can toggle map/document
- ✅ Can compare multiple zones

### **State 2: Limited Access (Free User with Coverage)**
- ✅ AI analysis visible
- ✅ Chat active (with limits)
- ⚠️ May hit usage limits after X questions
- ✅ Can toggle map/document

### **State 3: No Coverage (Zone Not Analyzed)**
- ❌ No AI analysis
- ❌ Chat disabled
- ✅ Official PDF visible
- ✅ Can view map
- 💰 Paywall with "Subscribe" CTA

---

## 🎯 Core UX Principles

### **1. Speed**
- Total time from address entry to first response: **< 5 seconds**
- Project creation is **automatic and invisible** (no interruption)
- No unnecessary clicks or forms
- No mandatory fields before starting
- Instant feedback at every step

### **2. Clarity**
- Always show what's happening (loading states)
- Clear distinction between available vs unavailable features
- Visual hierarchy: most important info first

### **3. Conversational**
- Chat-first, not form-first
- Natural language, not bureaucratic
- AI explains regulations in architect-friendly language

### **4. Focused Attention**
- One primary action at a time
- Artifact panel complements chat (doesn't distract)
- Map and document never compete for attention (switching, not overlapping)

### **5. Professional**
- Clean, minimal interface
- Trustworthy (official sources always cited)
- Architect-grade quality (not consumer-app casual)

### **6. Progressive Disclosure**
- Start simple: just enter an address
- Add details later: project name, description, type
- Organize as needed: multiple conversations per project

### **7. Flexibility**
- One conversation can reference **multiple documents** (zone comparisons)
- Projects can have **multiple conversations** (different aspects)
- Main address is **informational** (not a constraint)

### **8. Zero Friction**
- No "Create Project" button required
- No forms before analyzing
- Edit anytime, skip if not needed

---

## 📱 Responsive Behavior

### **Desktop (>1200px)**
- Split screen: Chat (40%) | Artifact (60%)
- Sidebar always visible with project hierarchy

### **Tablet (768px - 1200px)**
- Split screen: Chat (50%) | Artifact (50%)
- Collapsible sidebar with hamburger menu

### **Mobile (<768px)**
- Stacked layout:
  - Chat takes full width
  - Artifact appears below (or in modal)
  - Map opens in fullscreen modal
- Hamburger menu for sidebar
- Project list in drawer

---

## 🚫 What This Is NOT

- **Not** a document search engine (Google-style)
- **Not** a multi-step form wizard
- **Not** a database browser
- **Not** a map-first interface
- **Not** a project management tool (Trello/Asana)

## ✅ What This IS

- **A chat interface** with intelligent document context
- **A conversation** with PLU regulations
- **A visual assistant** (map + structured analysis)
- **An architect's copilot** for urban planning compliance
- **A lightweight organizer** for related conversations

---

## 🎨 Visual Identity

- **Color scheme**: Black, white, greys (from brand guidelines)
- **Typography**: Lato (from brand guidelines)
- **Spacing**: 4px grid system
- **Tone**: Professional yet approachable
- **Icons**: Simple, functional (not playful)
- **Loading states**: Elegant, not gimmicky

---

## 💬 Sample Conversation Flow

```
User: [Enters "15 rue Auguste Gaché, Grenoble"]
      [System auto-creates project + conversation]

AI: ✅ Analyse chargée pour 15 rue Auguste Gaché, Grenoble
    Zone UA - Zone urbaine dense
    
    [Sidebar shows: 📁 Sans nom]
    
    Points clés:
    • Hauteur max: 12m
    • Emprise: 60%
    • Recul: 5m minimum
    
    💬 Que souhaitez-vous savoir?

User: [Clicks "Sans nom" → Renames to "Maison Grenoble"]

User: Je veux construire une extension de 25m². C'est possible?

AI: Oui, c'est possible sous certaines conditions. Voici les points 
    à vérifier:
    
    1️⃣ Emprise au sol: Votre parcelle doit avoir une emprise 
    disponible. Avec une limite de 60%, pour 25m² supplémentaires, 
    votre parcelle doit faire au minimum 42m² au total.
    
    2️⃣ Hauteur: L'extension ne peut pas dépasser 12m (article UB 10).
    
    3️⃣ Recul: L'extension doit respecter un recul minimum de 5m 
    par rapport aux limites séparatives.
    
    Souhaitez-vous plus de détails sur l'un de ces points?

User: Compare cette zone avec la zone UB voisine

AI: J'analyse les 2 zones pour vous...
    
    📍 Zone UA (votre adresse)
    • Hauteur: 12m | Emprise: 60%
    
    📍 Zone UB (voisine)  
    • Hauteur: 9m | Emprise: 50%
    
    Votre parcelle est dans la zone la plus permissive.
    
    [Artifact shows both documents, toggleable]

User: Parfait, merci

User: [Starts new search: "20 avenue Mozart, Lyon"]
      [New project auto-created: "📁 Sans nom"]
      [Sidebar now shows 2 projects:
       - 🏠 Maison Grenoble
       - 📁 Sans nom]
```

---

## 🎯 Success Criteria

A user should be able to:
1. **Start analyzing immediately** without creating accounts or filling forms
2. **Enter address** → **See analysis** in under 5 seconds
3. **Ask 3-5 questions** and get complete answers in under 2 minutes
4. **Understand** if their project is feasible (yes/no/maybe) within 5 minutes
5. **Find specific regulations** without reading the 500-page source document
6. **Feel confident** citing the information to clients (because sources are shown)
7. **Organize work naturally** as projects emerge (not forced upfront)
8. **Compare multiple zones** in a single conversation
9. **Return to past projects** easily via sidebar
10. **Edit project details** only if/when needed

---

**Key Philosophy**: Create structure automatically, let users refine it progressively. Never block the primary action (address analysis) with organizational overhead.
