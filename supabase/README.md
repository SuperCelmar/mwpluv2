# MWPLU â€” Documentation des SchÃ©mas de Base de DonnÃ©es

## Vue d'ensemble

La base de donnÃ©es MWPLU est organisÃ©e en deux schÃ©mas principaux : **public** et **analytics**. Elle stocke les donnÃ©es des utilisateurs, des documents PLU, des conversations IA, et des mÃ©triques analytiques.

---

## SCHÃ‰MA PUBLIC

### 1. **Gestion des Utilisateurs & Profils**

#### `profiles`
Stocke les informations de profil des utilisateurs authentifiÃ©s.
- `id` (uuid) : Identifiant unique, liÃ© Ã  `auth.users`
- `email`, `first_name`, `last_name`, `full_name` : DonnÃ©es personnelles
- `phone`, `pseudo`, `avatar_url` : Informations optionnelles
- `is_admin` : Indicateur de droits administrateur
- `deletion_requested_at`, `deletion_scheduled_for`, `deletion_reason` : Gestion de suppression de compte
- `created_at`, `updated_at` : Horodatage

#### `user_download_limits`
GÃ¨re les quotas de tÃ©lÃ©chargement par utilisateur.
- `user_id` (uuid, clÃ© primaire) : RÃ©fÃ©rence Ã  `auth.users`
- `free_quota` : Nombre de tÃ©lÃ©chargements gratuits (dÃ©faut: 5)
- `paid_credits` : CrÃ©dits achetÃ©s
- `created_at`, `updated_at` : Horodatage

#### `research_history`
Enregistre l'historique des recherches d'adresse par les utilisateurs.
- `id` (uuid) : Identifiant unique
- `user_id` : RÃ©fÃ©rence utilisateur
- `address_input` : Adresse saisie par l'utilisateur
- `city_id`, `zone_label` : Localisation rÃ©sultante
- `geo_lon`, `geo_lat` : CoordonnÃ©es gÃ©ographiques
- `success` : BoolÃ©en indiquant le succÃ¨s de la recherche
- `reason` : Message d'erreur si applicable

#### `view_history`
Enregistre quels documents ont Ã©tÃ© consultÃ©s par quel utilisateur.
- `id` (uuid) : Identifiant unique
- `user_id`, `document_id` : RÃ©fÃ©rences
- `viewed_at` : Timestamp de la consultation

---

### 2. **DonnÃ©es GÃ©ographiques & PLU**

#### `cities`
Liste des villes gÃ©rÃ©es dans le systÃ¨me.
- `id` (uuid) : Identifiant unique
- `name` (varchar, unique) : Nom de la ville
- `created_at`, `updated_at` : Horodatage

#### `zonings`
Documents PLU ou pÃ©rimÃ¨tres de zonage pour chaque ville.
- `id` (uuid) : Identifiant unique
- `city_id` : RÃ©fÃ©rence Ã  la ville
- `name`, `description` : Titre et description du zonage
- `created_at`, `updated_at` : Horodatage

#### `zones`
Zones individuelles dÃ©finies au sein d'un PLU (ex: zone urbaine, agricole, etc.).
- `id` (uuid) : Identifiant unique
- `zoning_id` : RÃ©fÃ©rence au PLU parent
- `name`, `description` : CaractÃ©ristiques de la zone
- `zones_constructibles` (bool) : Indique si la zone est constructible
- `created_at`, `updated_at` : Horodatage

#### `documents`
Documents PLU complets avec contenus analytiques.
- `id` (uuid) : Identifiant unique
- `zoning_id`, `zone_id` : RÃ©fÃ©rences gÃ©ographiques
- `typology_id` : Type de document (liÃ© Ã  `typologies`)
- `content_json` (jsonb) : Contenu structurÃ© du PLU en JSON
- `html_content` : ReprÃ©sentation HTML du document
- `pdf_storage_path` : Chemin de stockage du PDF
- `source_plu_url`, `source_plu_date` : RÃ©fÃ©rence et date du document officiel
- `created_at`, `updated_at` : Horodatage

#### `typologies`
Classification des types de documents PLU.
- `id` (uuid) : Identifiant unique
- `name`, `description` : CatÃ©gorie de document
- `created_at`, `updated_at` : Horodatage

---

### 3. **SystÃ¨me de Chat & Conversations IA**

#### `chat_conversations`
ReprÃ©sente une conversation utilisateur sur un document spÃ©cifique.
- `id` (uuid) : Identifiant unique
- `user_id` : Utilisateur propriÃ©taire
- `document_id` : Document PLU analysÃ©
- `is_active` (bool) : Statut de la conversation
- `last_message_at` : Timestamp du dernier message
- `created_at` : Horodatage de crÃ©ation

#### `chat_messages`
Messages individuels au sein d'une conversation.
- `id` (uuid) : Identifiant unique
- `conversation_id` : RÃ©fÃ©rence Ã  la conversation parent
- `user_id`, `document_id` : Contexte
- `role` (text) : `'user'` ou `'assistant'`
- `message` : Contenu du message
- `metadata` (jsonb) : DonnÃ©es additionnelles (ex: source, confiance)
- `conversation_turn` : NumÃ©ro du tour dans la conversation
- `reply_to_message_id` : Pour les rÃ©ponses Ã  un message spÃ©cifique
- `created_at` : Horodatage

---

### 4. **Interactions Utilisateur**

#### `ratings`
Ã‰valuations des documents par les utilisateurs.
- `id` (uuid) : Identifiant unique
- `document_id`, `user_id` : RÃ©fÃ©rences
- `rating` (int) : Score de 1 Ã  5
- `created_at`, `updated_at` : Horodatage

#### `comments`
Commentaires laissÃ©s sur les documents.
- `id` (uuid) : Identifiant unique
- `document_id`, `user_id` : RÃ©fÃ©rences
- `content` : Texte du commentaire
- `created_at`, `updated_at` : Horodatage

#### `comments_deleted`
Archive des commentaires supprimÃ©s (conservation lÃ©gale).
- `id` (uuid) : Identifiant unique
- MÃªme structure que `comments`
- `deleted_status` (bool) : Marque de suppression
- `deleted_at` : Timestamp de suppression

#### `downloads`
Historique des tÃ©lÃ©chargements de documents.
- `id` (uuid) : Identifiant unique
- `document_id`, `user_id` : RÃ©fÃ©rences
- `type` (text) : Type de tÃ©lÃ©chargement (dÃ©faut: `'pdf'`)
- `created_at` : Horodatage

---

### 5. **Gestion des Contacts & Blog**

#### `contact_messages`
Messages soumis via le formulaire de contact sur mwplu.com.
- `id` (uuid) : Identifiant unique
- `name`, `email`, `subject`, `message` : DonnÃ©es du message
- `status` : Ã‰tat (`'pending'`, etc.)
- `created_at`, `updated_at` : Horodatage

#### `company_context`
Informations de contexte entreprise pour les contenus (mission, ton, etc.).
- `id` (uuid) : Identifiant unique
- `name`, `mission` : Informations de base
- `values` (text[]) : Valeurs de l'entreprise
- `tone`, `messaging`, `brand_voice_guidelines` : Directives de communication
- `is_active` (bool) : Activation du contexte
- `created_by` : Auteur
- `created_at`, `updated_at` : Horodatage

#### `blog_categories`
CatÃ©gories d'articles blog.
- `id` (uuid) : Identifiant unique
- `name`, `slug` (unique) : CatÃ©gorie et URL-friendly slug
- `description`, `color` : DÃ©tails de prÃ©sentation
- `is_active` (bool) : Publication
- `created_at` : Horodatage

#### `blog_tags`
Tags (Ã©tiquettes) pour les articles blog.
- `id` (uuid) : Identifiant unique
- `name`, `slug` (unique) : Tag et slug
- `description` : Explication
- `usage_count` : Nombre d'articles utilisant ce tag
- `created_at` : Horodatage

#### `blog_articles`
Articles de blog complets.
- `id` (uuid) : Identifiant unique
- `title`, `slug` (unique) : Titre et URL
- `excerpt`, `content`, `markdown_content` : Contenus
- `cover_image_url` : Image de couverture
- `status` : Ã‰tat (`'draft'`, `'ready'`, `'scheduled'`, `'published'`, `'archived'`)
- `scheduled_at`, `published_at`, `archived_at` : Horodatages d'Ã©tat
- `meta_title`, `meta_description`, `canonical_url` : MÃ©tadonnÃ©es SEO
- `og_title`, `og_description`, `og_image_url` : MÃ©tadonnÃ©es OpenGraph
- `twitter_title`, `twitter_description`, `twitter_image_url` : MÃ©tadonnÃ©es Twitter
- `category_id`, `author_id` : RÃ©fÃ©rences
- `ai_generated` (bool) : GÃ©nÃ©rÃ©s par IA
- `ai_prompts_used` (text[]) : Prompts IA utilisÃ©s
- `human_edit_ratio` : Ratio d'Ã©dition humaine
- `view_count`, `scroll_depth_avg` : MÃ©triques d'engagement
- `cta_clicks`, `outlink_clicks` : Clics de conversion
- `created_at`, `updated_at` : Horodatage

#### `blog_article_tags`
Association many-to-many entre articles et tags.
- `article_id`, `tag_id` : ClÃ©s Ã©trangÃ¨res

#### `blog_content_planner`
Planification de contenu blog.
- `id` (uuid) : Identifiant unique
- `title`, `topic` : Sujet planifiÃ©
- `target_keywords` (text[]) : Mots-clÃ©s SEO
- `content_brief` : RÃ©sumÃ© du contenu
- `target_publish_date` : Date de publication prÃ©vue
- `priority` : Niveau de prioritÃ©
- `status` : Ã‰tat (`'planned'`, `'in_progress'`, `'completed'`, `'cancelled'`)
- `article_id` : Article associÃ© (si existant)
- `assigned_to` : Personne responsable
- `created_at`, `updated_at` : Horodatage

#### `blog_analytics_events`
Ã‰vÃ©nements analytiques granulaires sur les articles.
- `id` (uuid) : Identifiant unique
- `article_id`, `user_id` : RÃ©fÃ©rences
- `event_type` : Type d'Ã©vÃ©nement (`'view'`, `'scroll'`, `'cta_click'`, etc.)
- `event_data` (jsonb) : DonnÃ©es additionnelles
- `session_id`, `ip_address`, `user_agent`, `referrer` : Contexte utilisateur
- `created_at` : Horodatage

#### `blog_seo_audits`
Audits SEO des articles blog.
- `id` (uuid) : Identifiant unique
- `article_id` : RÃ©fÃ©rence Ã  l'article
- `audit_type` : Type d'audit effectuÃ©
- `lighthouse_score`, `seo_score` : Scores de performance
- `issues` (jsonb) : ProblÃ¨mes identifiÃ©s
- `recommendations` (jsonb) : Recommandations d'amÃ©lioration
- `audited_at` : Horodatage d'audit

---

## SCHÃ‰MA ANALYTICS

Tables d'agrÃ©gation et mÃ©triques analytiques. RafraÃ®chies via vues matÃ©rialisÃ©es ou triggers.

### 1. **Ã‰vÃ©nements DÃ©taillÃ©s**

#### `chat_events`
Log brut de **chaque interaction IA**. Source de vÃ©ritÃ© pour toutes les analyses.
- `id` (uuid) : Identifiant unique
- `conversation_id`, `message_id`, `document_id`, `user_id` : RÃ©fÃ©rences contextuelles
- `model_name`, `model_version`, `model_provider` : ModÃ¨le IA utilisÃ©
- `tokens_prompt`, `tokens_completion`, `tokens_cached`, `tokens_total` : Tokens consommÃ©s
- `cost_prompt`, `cost_completion`, `cost_cached`, `cost_total` : CoÃ»t en EUR
- `response_time_ms` : Temps de rÃ©ponse en millisecondes
- `cache_hit` (bool) : Hit du cache
- `user_query_length`, `ai_response_length` : Longueurs des messages
- `user_feedback_rating` (1-5) : Ã‰valuation utilisateur
- `user_feedback_text`, `user_feedback_at` : Retours utilisateur
- `error_occurred` (bool) : Indicateur d'erreur
- `error_message`, `error_code` : DÃ©tails d'erreur
- `query_intent` : Intention dÃ©tectÃ©e (ex: `'compliance'`, `'height_restriction'`)
- `sections_referenced` (text[]) : Sections du PLU rÃ©fÃ©rencÃ©es
- `intermediate_steps` : Nombre d'Ã©tapes d'IA
- `metadata` (jsonb) : DonnÃ©es additionnelles
- `created_at`, `updated_at` : Horodatage

### 2. **AgrÃ©gations Quotidiennes**

#### `user_daily_usage`
Utilisation **quotidienne par utilisateur**.
- `id` (uuid) : Identifiant unique
- `user_id`, `date` : Utilisateur et date (clÃ© composÃ©e)
- `message_count`, `conversation_count`, `document_count` : Compteurs
- `tokens_total`, `tokens_cached` : Utilisation des tokens
- `cache_hit_count`, `cost_total`, `cost_saved_by_cache` : CoÃ»ts
- `avg_response_time_ms`, `median_response_time_ms`, `p95_response_time_ms` : Temps
- `error_count`, `avg_feedback_rating`, `feedback_count` : QualitÃ©
- `created_at`, `updated_at` : Horodatage

#### `system_daily_metrics`
MÃ©triques **systÃ¨me-wide quotidiennes** (adminonly).
- `id` (uuid) : Identifiant unique
- `date` (unique) : Date du jour
- `active_users`, `new_users` : Utilisateurs
- `total_messages`, `total_conversations`, `total_documents_accessed` : Volumes
- `tokens_total`, `tokens_cached`, `cache_hit_rate` : Utilisation IA
- `cost_total`, `cost_per_message`, `cost_saved_by_cache` : CoÃ»ts
- `avg_response_time_ms`, `p95_response_time_ms` : Performance
- `error_count`, `error_rate` : Erreurs
- `avg_feedback_rating` : Satisfaction
- `model_distribution` (jsonb) : Distribution des modÃ¨les IA
- `created_at`, `updated_at` : Horodatage

#### `document_usage`
Utilisation **quotidienne par document**.
- `id` (uuid) : Identifiant unique
- `document_id`, `date` : Document et date
- `query_count`, `unique_users`, `conversation_count` : Volumes
- `tokens_total`, `avg_tokens_per_query` : Tokens consommÃ©s
- `cost_total`, `avg_response_time_ms` : CoÃ»ts et performance
- `cache_hit_rate` : EfficacitÃ© cache
- `avg_feedback_rating`, `feedback_count`, `error_count` : QualitÃ©
- `top_sections` (jsonb) : Sections les plus interrogÃ©es
- `created_at`, `updated_at` : Horodatage

### 3. **AgrÃ©gations Mensuelles**

#### `user_monthly_usage`
Utilisation **mensuelle par utilisateur**. UtilisÃ©e pour facturation et limites.
- `id` (uuid) : Identifiant unique
- `user_id`, `year`, `month` : Identifiant temporel
- `year_month` (gÃ©nÃ©rÃ©) : Format `'YYYY-MM'`
- `message_count`, `conversation_count`, `document_count` : Compteurs
- `active_days` : Jours d'activitÃ©
- `tokens_total`, `tokens_cached`, `cache_hit_rate` : Tokens et cache
- `cost_total`, `cost_saved_by_cache` : CoÃ»ts
- `avg_response_time_ms`, `error_count`, `error_rate` : Performance et fiabilitÃ©
- `avg_feedback_rating`, `feedback_count` : Satisfaction
- `monthly_message_limit`, `monthly_token_limit`, `monthly_cost_limit` : Limites
- `limit_reached` (bool), `limit_reached_at` : Atteinte des limites
- `notified_80_percent`, `notified_100_percent` : Statut de notifications
- `created_at`, `updated_at` : Horodatage

---

## RÃ¨gles de SÃ©curitÃ© (RLS)

Tous les tables publiques ont **RLS activÃ©**. Les politiques garantissent que :
- Les utilisateurs ne voient que leurs propres donnÃ©es
- Les administrateurs ont accÃ¨s complet
- Les donnÃ©es sensibles sont protÃ©gÃ©es

---

## ConsidÃ©rations RGPD

- âœ… Stockage dans l'UE (eu-west-3)
- âœ… Chiffrement des donnÃ©es en transit
- âœ… Suppression programmable d'utilisateurs
- âœ… Archivage des commentaires supprimÃ©s
- âœ… Logs d'accÃ¨s via analytics