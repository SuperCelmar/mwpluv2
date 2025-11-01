import { NextRequest, NextResponse } from 'next/server';

const N8N_WEBHOOK_URL = 'https://n8n.automationdfy.com/webhook/api/chat';

export async function POST(req: NextRequest) {
  try {
    const { message, projectId, address, isInitialAnalysis, new_conversation, user_id, conversation_id, gps_coordinates, insee_code } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 });
    }

    if (!conversation_id) {
      return NextResponse.json({ error: 'Conversation ID requis' }, { status: 400 });
    }

    const webhookPayload: any = {
      new_conversation: new_conversation || false,
      message: message || '',
      user_id: user_id || '',
      conversation_id: conversation_id || '',
    };

    if (gps_coordinates) {
      webhookPayload.gps_coordinates = gps_coordinates;
    }

    if (insee_code) {
      webhookPayload.insee_code = insee_code;
    }

    if (address) {
      webhookPayload.address = address;
    }

    const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error(`Webhook returned ${webhookResponse.status}`);
      return NextResponse.json({
        message: "Désolé, une erreur est survenue lors du traitement de votre demande. L'équipe technique a été informée."
      });
    }

    const webhookData = await webhookResponse.json();

    return NextResponse.json({ message: webhookData.message || webhookData.response || 'Réponse reçue' });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json({
      message: "Désolé, une erreur est survenue. Veuillez réessayer dans quelques instants."
    });
  }
}
