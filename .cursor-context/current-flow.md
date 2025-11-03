# Current Address Submission Flow

Location: app/page.tsx (with InitialAddressInput component)

Flow:
1. User enters address in InitialAddressInput
2. On submit → triggers handler (find it in app/page.tsx)
3. Handler calls:
   - lib/carto-api.ts → getMunicipalityData(insee)
   - lib/carto-api.ts → getZoneUrbaData(coordinates)
4. Then calls lib/geo-enrichment.ts to enrich DB
5. Creates records in v2_projects, v2_conversations, v2_research_history
6. Navigates to /chat/[conversation_id]

Problem: Steps 3-4 happen BEFORE checking for duplicates
Goal: Check duplicates FIRST (step 2.5), skip steps 3-5 if duplicate exists