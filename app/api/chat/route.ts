import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL || 'https://n8n.automationdfy.com/webhook/mwplu/chat';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  console.log('[CHAT_API] Chat API request received');

  try {
    const body = await req.json();
    const {
      message,
      message_id,
      address,
      new_conversation,
      user_id,
      conversation_id,
      gps_coordinates,
      context_metadata,
      document_ids,
      document_id,
      branch_type,
    } = body;

    if (!message) {
      console.error('[CHAT_API] Validation error: Message is required');
      return NextResponse.json({ error: 'Message requis' }, { status: 400 });
    }

    if (!conversation_id) {
      console.error('[CHAT_API] Validation error: Conversation ID is required');
      return NextResponse.json({ error: 'Conversation ID requis' }, { status: 400 });
    }

    if (!message_id) {
      console.error('[CHAT_API] Validation error: Message ID is required to notify webhook');
      return NextResponse.json({ error: 'Message ID requis' }, { status: 400 });
    }

    const webhookPayload: Record<string, any> = {
      new_conversation: !!new_conversation,
      message,
      message_id,
      user_id: user_id || '',
      conversation_id,
      branch_type: branch_type || null,
    };

    if (typeof document_id === 'string') {
      webhookPayload.document_id = document_id;
    }

    if (Array.isArray(document_ids) && document_ids.length > 0) {
      webhookPayload.document_ids = document_ids;
    }

    if (address) {
      webhookPayload.address = address;
    }

    if (
      Array.isArray(gps_coordinates) &&
      gps_coordinates.length === 2 &&
      gps_coordinates.every((value) => typeof value === 'number')
    ) {
      webhookPayload.gps_coordinates = gps_coordinates;
    }

    if (context_metadata) {
      webhookPayload.context_metadata = context_metadata;
    }


    const maxAttempts = 2;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });

        if (webhookResponse.ok) {
          const contentType = webhookResponse.headers.get('content-type');
          let webhookData: any = {};
          
          // Get response text first (can only read body once)
          const responseText = await webhookResponse.text();
          
          // Try to parse as JSON if content-type suggests it
          if (contentType?.includes('application/json')) {
            try {
              webhookData = JSON.parse(responseText);
            } catch (e) {
              // If JSON parsing fails, treat as plain text
              webhookData = { raw: responseText };
            }
          } else {
            // Not JSON, treat as plain text
            webhookData = { raw: responseText };
          }
          
          // Try multiple possible response fields
          const responseMessage =
            webhookData?.message ||
            webhookData?.response ||
            webhookData?.text ||
            webhookData?.content ||
            webhookData?.data?.message ||
            webhookData?.data?.response ||
            webhookData?.result?.message ||
            webhookData?.result?.response ||
            (typeof webhookData === 'string' ? webhookData : null) ||
            (webhookData?.raw && typeof webhookData.raw === 'string' ? webhookData.raw : null) ||
            'Réponse reçue';
          
          return NextResponse.json({
            success: true,
            message: responseMessage,
          });
        }
        
        lastError = `Status ${webhookResponse.status}`;
        console.warn('[CHAT_API] Webhook attempt failed:', lastError);
      } catch (error) {
        lastError = error;
        console.error('[CHAT_API] Error calling webhook:', error);
      }

      if (attempt < maxAttempts) {
        await delay(300 * attempt);
      }
    }

    console.error('[CHAT_API] All webhook attempts failed:', lastError);
    return NextResponse.json({
      success: false,
      message:
        "L'assistant est temporairement indisponible. Votre question a bien été enregistrée.",
    });
  } catch (error: any) {
    console.error('[CHAT_API] Error in chat API:', error);
    return NextResponse.json({
      success: false,
      message: "Désolé, une erreur est survenue. Veuillez réessayer dans quelques instants.",
    });
  }
}
