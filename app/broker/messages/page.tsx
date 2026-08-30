'use client';

import ParticipantMessagesPage from '../../components/workspace/ParticipantMessagesPage';

export default function BrokerMessagesPage() {
  return (
    <ParticipantMessagesPage
      eyebrow="Broker communication"
      description="Continue verified participant conversations with transport counterparties. Messaging remains separate from operational alerts and cannot be edited after sending."
    />
  );
}
