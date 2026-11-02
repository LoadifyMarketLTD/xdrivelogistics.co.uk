'use client';

import ParticipantMessagesPage from '../../components/workspace/ParticipantMessagesPage';

export default function CustomerMessagesPage() {
  return (
    <ParticipantMessagesPage
      eyebrow="Customer communication"
      description="Continue verified participant conversations linked to your transport activity. Messages are separate from operational alerts and cannot be edited after sending."
    />
  );
}
