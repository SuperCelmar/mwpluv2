import { Conversation, Message } from './store';

export const mockAddresses = [
  {
    id: '1',
    label: '12 rue de la République, 35000 Rennes',
    street: '12 rue de la République',
    postalCode: '35000',
    city: 'Rennes',
  },
  {
    id: '2',
    label: '45 avenue Jean Jaurès, 75019 Paris',
    street: '45 avenue Jean Jaurès',
    postalCode: '75019',
    city: 'Paris',
  },
  {
    id: '3',
    label: '8 boulevard Victor Hugo, 44000 Nantes',
    street: '8 boulevard Victor Hugo',
    postalCode: '44000',
    city: 'Nantes',
  },
  {
    id: '4',
    label: '23 rue du Commerce, 69002 Lyon',
    street: '23 rue du Commerce',
    postalCode: '69002',
    city: 'Lyon',
  },
  {
    id: '5',
    label: '17 place de la Liberté, 31000 Toulouse',
    street: '17 place de la Liberté',
    postalCode: '31000',
    city: 'Toulouse',
  },
];

export function searchAddresses(query: string) {
  if (!query || query.length < 3) return [];

  return mockAddresses.filter((addr) =>
    addr.label.toLowerCase().includes(query.toLowerCase())
  );
}

export function generateInitialAnalysis(address: string): Message {
  return {
    id: `msg-${Date.now()}-1`,
    role: 'assistant',
    content: `Voici l'analyse de votre PLU pour l'adresse **${address}**.

Votre projet se situe en **Zone Uc - Zone urbaine centre**. Cette zone est destinée principalement à l'habitat avec la possibilité d'accueillir des activités compatibles.

**Points clés à retenir :**

• **Constructible** : Oui, cette zone est constructible pour l'habitat
• **Hauteur maximale** : 12 mètres (soit environ R+3) [→ Art.10]
• **Emprise au sol** : 60% maximum de la surface du terrain [→ Art.9]
• **Vocation** : Habitat et commerces de proximité
• **Stationnement** : 1 place par logement minimum [→ Art.12]

Le PLU de cette commune a été approuvé le 15 juin 2023 et est actuellement en vigueur.`,
    citations: [
      { article: 'Art.10', page: 15 },
      { article: 'Art.9', page: 14 },
      { article: 'Art.12', page: 18 },
    ],
    timestamp: new Date(),
    suggestedQuestions: [
      'Quelle est la surface minimale de terrain requise ?',
      'Y a-t-il des servitudes sur cette zone ?',
      'Puis-je construire un étage supplémentaire ?',
    ],
  };
}

export function generateMockResponse(question: string): Message {
  const responses: { [key: string]: Partial<Message> } = {
    hauteur: {
      content: `La hauteur maximale des constructions est de **12 mètres** [→ Art.10], mesurée depuis le sol naturel jusqu'au point le plus haut de la toiture (faîtage ou acrotère).

Des exceptions existent pour :
• Les équipements publics qui peuvent atteindre 15 mètres [→ Art.10.2]
• Les éléments techniques (cheminées, antennes) dans la limite de 2 mètres supplémentaires [→ Art.10.3]

Cette hauteur correspond généralement à un bâtiment de rez-de-chaussée + 3 étages (R+3).`,
      citations: [
        { article: 'Art.10', page: 15 },
        { article: 'Art.10.2', page: 15 },
        { article: 'Art.10.3', page: 16 },
      ],
      suggestedQuestions: [
        'Comment mesure-t-on exactement la hauteur ?',
        'Quelle est la règle pour les toits en pente ?',
        'Y a-t-il des restrictions sur le nombre d\'étages ?',
      ],
    },
    surface: {
      content: `Pour la zone Uc, il n'y a **pas de surface minimale de terrain imposée** [→ Art.5]. Cependant, le terrain doit permettre de respecter les autres règles du PLU, notamment :

• **Emprise au sol maximale** : 60% de la surface du terrain [→ Art.9]
• **Espaces verts** : Au moins 30% de la surface doit rester en pleine terre [→ Art.13]
• **Coefficient de biotope** : Minimum de 0.3 doit être respecté [→ Art.13.2]

En pratique, pour un projet d'habitat individuel, on recommande une surface minimale d'environ 200m² pour respecter confortablement l'ensemble des règles.`,
      citations: [
        { article: 'Art.5', page: 10 },
        { article: 'Art.9', page: 14 },
        { article: 'Art.13', page: 19 },
        { article: 'Art.13.2', page: 19 },
      ],
      suggestedQuestions: [
        'Qu\'est-ce que le coefficient de biotope ?',
        'Puis-je compter les toitures végétalisées ?',
        'Y a-t-il des règles pour les piscines ?',
      ],
    },
    default: {
      content: `Je suis désolé, mais je n'ai pas d'information spécifique sur ce point dans le PLU actuel. Pouvez-vous reformuler votre question ou me donner plus de détails sur ce que vous recherchez ?

Voici quelques questions fréquentes que je peux vous aider à traiter :
• Les règles de hauteur et d'emprise au sol
• Les distances à respecter par rapport aux limites du terrain
• Les règles de stationnement
• Les servitudes et contraintes particulières`,
      suggestedQuestions: [
        'Quelles sont les règles de hauteur ?',
        'Y a-t-il des contraintes de stationnement ?',
        'Puis-je faire une extension ?',
      ],
    },
  };

  const lowerQuestion = question.toLowerCase();
  let response;

  if (lowerQuestion.includes('hauteur') || lowerQuestion.includes('haut') || lowerQuestion.includes('mètre')) {
    response = responses.hauteur;
  } else if (lowerQuestion.includes('surface') || lowerQuestion.includes('terrain') || lowerQuestion.includes('minimale')) {
    response = responses.surface;
  } else {
    response = responses.default;
  }

  return {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content: response.content!,
    citations: response.citations,
    timestamp: new Date(),
    suggestedQuestions: response.suggestedQuestions,
  };
}

export function generateConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
