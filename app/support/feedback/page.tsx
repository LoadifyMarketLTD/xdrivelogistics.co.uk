'use client';

import ProtectedRoute from '../../components/ProtectedRoute';
import UserFeedbackForm from '../../components/UserFeedbackForm';

export default function FeedbackPage() {
  return (
    <ProtectedRoute>
      <main className="page">
        <div className="shell">
          <UserFeedbackForm />
        </div>
        <style jsx>{`
          .page {
            min-height: 100vh;
            background: #F4F6F8;
            color: #1A1F2B;
            padding: 24px;
          }

          .shell {
            width: min(900px, 100%);
            margin: 0 auto;
          }

          @media (max-width: 640px) {
            .page {
              padding: 14px;
            }
          }
        `}</style>
      </main>
    </ProtectedRoute>
  );
}
