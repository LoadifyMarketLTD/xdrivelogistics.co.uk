'use client';

import type { FormHTMLAttributes, ReactNode } from 'react';

export default function WorkspaceForm({ children, ...props }: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode }) {
  return <form className="workspace-form" {...props}>{children}</form>;
}
