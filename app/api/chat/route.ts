import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 
  'https://n8n.automationdfy.com/webhook/api/chat';

export async function POST(req: NextRequest) {
  console.log('[CHAT_API] Chat API request received');
  
  try {
    const {
      message,
      ConversationId,
      address,
      isInitialAnalysis,
      new_conversation,
      user_id,
      conversation_id,
      gps_coordinates,
      insee_code,
      context_metadata,
      document_ids,
    } = await req.json();

    console.log('[CHAT_API] Request payload:', {
      hasMessage: !!message,
      messageLength: message?.length || 0,
      new_conversation,
      user_id,
      conversation_id,
      hasAddress: !!address,
      hasGpsCoordinates: !!gps_coordinates,
      insee_code,
      hasContextMetadata: !!context_metadata,
      document_idsCount: document_ids?.length || 0,
    });

    if (!message) {
      console.error('[CHAT_API] Validation error: Message is required');
      return NextResponse.json({ error: 'Message requis' }, { status: 400 });
    }

    if (!conversation_id) {
      console.error('[CHAT_API] Validation error: Conversation ID is required');
      return NextResponse.json({ error: 'Conversation ID requis' }, { status: 400 });
    }

    console.log('[CHAT_API] Constructing webhook payload');
    
    const webhookPayload: any = {
      new_conversation: new_conversation || false,
      message: message || '',
      user_id: user_id || '',
      conversation_id: conversation_id || '',
    };

    if (gps_coordinates) {
      webhookPayload.gps_coordinates = gps_coordinates;
      console.log('[CHAT_API] Added GPS coordinates to payload');
    }

    if (insee_code) {
      webhookPayload.insee_code = insee_code;
      console.log('[CHAT_API] Added INSEE code to payload:', insee_code);
    }

    if (address) {
      webhookPayload.address = address;
      console.log('[CHAT_API] Added address to payload');
    }

    // Add v2 context metadata
    if (context_metadata) {
      webhookPayload.context_metadata = context_metadata;
      console.log('[CHAT_API] Added context metadata to payload');
    }

    // Add document IDs (v2 many-to-many relationship)
    if (document_ids && Array.isArray(document_ids) && document_ids.length > 0) {
      webhookPayload.document_ids = document_ids;
      console.log('[CHAT_API] Added document IDs to payload, count:', document_ids.length);
    }

    console.log('[CHAT_API] Webhook payload constructed:', {
      new_conversation: webhookPayload.new_conversation,
      messageLength: webhookPayload.message?.length || 0,
      user_id: webhookPayload.user_id,
      conversation_id: webhookPayload.conversation_id,
      hasGpsCoordinates: !!webhookPayload.gps_coordinates,
      hasInseeCode: !!webhookPayload.insee_code,
      hasAddress: !!webhookPayload.address,
      hasContextMetadata: !!webhookPayload.context_metadata,
      documentIdsCount: webhookPayload.document_ids?.length || 0,
    });

    console.log('[CHAT_API] Sending webhook request to:', N8N_WEBHOOK_URL);
    
    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    console.log('[CHAT_API] Webhook response status:', webhookResponse.status);

    if (!webhookResponse.ok) {
      console.error('[CHAT_API] Webhook returned error status:', webhookResponse.status);
      return NextResponse.json({
        message: "Désolé, une erreur est survenue lors du traitement de votre demande. L'équipe technique a été informée."
      });
    }

    console.log('[CHAT_API] Webhook response received successfully');
    const webhookData = await webhookResponse.json();
    console.log('[CHAT_API] Webhook response data parsed:', {
      hasMessage: !!webhookData.message,
      hasResponse: !!webhookData.response,
      messageLength: webhookData.message?.length || 0,
    });

    const responseMessage = webhookData.message || webhookData.response || 'Réponse reçue';
    console.log('[CHAT_API] Returning response to client, message length:', responseMessage.length);

    return NextResponse.json({ message: responseMessage });
  } catch (error: any) {
    console.error('[CHAT_API] Error in chat API:', error);
    return NextResponse.json({
      message: "Désolé, une erreur est survenue. Veuillez réessayer dans quelques instants."
    });
  }
}
