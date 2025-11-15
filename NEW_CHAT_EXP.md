# User Flow and Technical Process Documentation

## Overview

This document provides a comprehensive high-level explanation to the user experience of the MWPLU address analysis system.

## Table of Contents

1. Address Input and Search
2. Address Selection and Conversation Creation
3. Navigation to Chat Page
4. Map Display and Zone Visualization
5. Document Retrieval and Analysis
6. Final Analysis Message Display
7. Artifact Rendering and Panel Management

---

## 1. Address Input and Search

- In the Chat Input, the user start typing its address.
- The dropdown menu appears, showing multiple potential address to complete its search.
- Clicking on one option inputs the address in the Chat Input Search Bar.
- The system now check for duplicate addresses in the database.
- If the system has found out the same or a close address in the database, a small sub-headline appears below the chat input, inform the user about it.
- The system will save this search in the `public.v2_research_history` table

## 2a. Address Submission & Conversation Redirection
- Clicking on the submit button will now redirect to the related project that has that address, to the last conversation.
- The conversation UI is simple: only the chat messages are shown. All inline cards appear in the chat. But the system don't open them automatically. Basically the conversation data are loaded from the database.

## 2b. Address Submission & Conversation Creation

If it's a new address.

- The User can click on the send button to start the conversation or press Enter.

- The UI layer transition to a chat conversation page (a transition page) where we have the input address as the first message of the user.
Then the assistant avatar on the assistant side of conversation. No message yet for the assistant, just its icon.

This layer it's almost like a skeleton. The horizontal header that shows the breadcrumb in the conversation page, is empty in this transition page.

## 3. Navigation to Chat Page

Once the lightweight conversation and untitled project are created:
- User is then directed to `/chat/[conversation_id]`
- The header will now show the breadcrumb with "Projet Sans Nom > {Address}" (three vertical dots button)

## 4. Map Display and Zone Visualization

### Map Artifact.
- Right aside the Assistant avatar, you'd have the first loading message: "Vérification de la zone concernée..."
- In the meantime, the system uses the point coordinates of the address api, previously collected in the first step, to display the map, using leaflet.
- Effectively, the right panel slides in, showing the map with the address marker.
- Just after that moment, using the point coordinates, the system will call the municipality API `https://apicarto.ign.fr/api/gpu/zone-urba` 
This will get: for example:

```json
{
    "insee": "75056",
    "name": "PARIS",
    "is_rnu": false,
    "is_deleted": false,
    "is_coastline": false
}
```

- If the corresponding municipality `is_rnu` = true, the system will simply process to fetch the RNU document from the `documents` table

- If the corresponding municpality `is_rnu` = false, the system will go ahead and proceed to the zone-urba api call: `https://apicarto.ign.fr/api/gpu/zone-urba` using the geom parameter as the input (point coordinates from address api)

This will output couple information, but what's really interesting to us is:

```json
{
    "libelle": "UA1",
    "libelong": "Centre ancien de Grenoble",
    "typezone": "U",
    "partition": "DU_200040715",
    "geometry": {
        "type": "MultiPolygon",
        "coordinates": [] // 3 dimension array that represent the zone.
        }
}
```

- Using the geometry details about the corresponding zone, the system will update the leaflet map, to render the zone that contains the address marker.

## 5. Document Retrieval and Analysis

At this very step:

- If the zone was `is_rnu`=true, the loading message of the assistant will now says: "Récupération du RNU..."
    - Right after that, the right panel will switch the document page, and will display the content of the RNU document previously pulled from the database.
    - The system will proceed to the last step.


- If the zone was `is_rnu`=false, the loading message of the assistant now says "Vérification de la présence d'analyse..."
    - using the `libelle` <-> `zone_name` mapping and the `typezone`<-> `zoning_name` mapping, the system, based on the `zone_id` can now check in the `public.document` table that we have an analysis or not for that zone.
    - If we don't find any data in the `public.zones` and `public.zonings` table for these 2 fields, the system will insert the data in the respective tables.
    - If we do find the zone and zonings, and we don't see any content in the `public.documents` tables for the columns `documents.content_json`, `documents.html_content`, nor `pdf_storage_path`. 
        - This means we have yet to cover the zone with an analysis. In this case document artifact will cease loading, and display the source link to the PLU: `documents.source_plu_text`
        - The document artifact display a html content that says we've yet to cover the zone, and below are the source link to the original urban document.

    - If we do find the zone and zonings, and we do have content in the `public.documents` tables for the columns `documents.content_json`, `documents.html_content`, nor `pdf_storage_path`.
        - This means we have the analysis.
        - The loading message of the assistant now displays: "Récupération de l'analyse..."
        - After one sec, the document artifact will display the analysis.
        - The system goes to the final step.

## 6. Final Analysis Message Display

Now the system will display the final assistant message, that will replace the loading message: 

- If the address was RNU: "Voici le RNU" 
- If the address was not RNU, and we don't have the analysis: "Nous n'avons pas encore couverte cette zone, voici le lien vers le document source."
- If the address was not RNU, and we do have an analysis: "Voici l'analyse de la zone {zone_name}"

## 7. Artifact Rendering and Panel Management

After the assistant message is displayed.
- The map inline card will be displayed. Clicking on it will refocus the Right Panel to the Map Artifact.

- The document inline will be displayed. Clicking on it will refocus the Right Panel to the Document Artifact.

## 8. End of process. Start of chat feature.

- No matter which case scenario, all the message now displayed in the chat, with the inline cards, should be saved in the `public.v2_conversations` table with the metadata to easily display the messages and the inline cards if we reopen the conversation.
The pulled documents related to this conversation, will be saved in the `public.v2_conversation_documents` table along with the `public.v2_projects_documents` table

- If we are in the case where we only have the source urban document link, with no analysis. The Chat Input bar will be disabled, hovering on it will display a small text: "Impossible de discuter avec ce document."

- Otherwise, in all other cases, the chat input bar will be usable. Sending a message through this interface, will trigger a webhook: 

`https://n8n.automationdfy.com/webhook/mwplu/chat`

with the body (example):

```json 
{
    "message_id": "321bf594-698e-43e2-8c57-bb4c0fb00fe1",
    "message": "Qu'en est il de la hauteur de la toiture",
    "document_id": "a77d7caa-732c-4c8c-adf4-9a8e4b9e3f20",
    "user_id": "8db45d29-4cf7-4f59-9dc4-76eb8452984f",
    "conversation_id": "fb95791e-52e1-4815-89c5-e2c2fb0529b9"
}
```

