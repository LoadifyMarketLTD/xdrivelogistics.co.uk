import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CxDiaryActions, { DIARY_JOB_SHEET_TABS } from '../app/components/workspace/CxDiaryActions';

type TestButtonProps = { children?: ReactNode; type?: string; onClick: () => void; disabled?: boolean; 'aria-expanded'?: boolean };
function buttons(node: ReactNode): ReactElement<TestButtonProps>[] {
  return Children.toArray(node).flatMap(child => !isValidElement<TestButtonProps>(child) ? [] : child.type === 'button' ? [child] : buttons(child.props.children));
}

describe('shared Diary actions', () => {
  it('opens each canonical section and toggles the card without submitting a form', () => {
    const onToggle = vi.fn();
    const onOpenTab = vi.fn();
    const actions = buttons(CxDiaryActions({ expanded: false, onToggle, onOpenTab }));
    expect(actions.map(button => button.props.children)).toEqual(['▾', 'POD', 'Order', 'Notes', 'History', 'Documents', 'View invoice (£)']);
    actions.forEach(button => { expect(button.props.type).toBe('button'); button.props.onClick(); });
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onOpenTab.mock.calls.map(([tab]) => DIARY_JOB_SHEET_TABS[tab as keyof typeof DIARY_JOB_SHEET_TABS])).toEqual(['pod', 'agreement', 'progress', 'event-log', 'evidence', 'invoice']);
  });

  it('respects role-filtered sections and invoice busy state', () => {
    const props = { expanded: true, onToggle: vi.fn(), onOpenTab: vi.fn() };
    const actions = buttons(CxDiaryActions({ ...props, visibleTabs: ['pod', 'invoice'], disabledTabs: ['invoice'], labels: { invoice: 'Creating Invoice…' } }));
    expect(actions.map(button => button.props.children)).toEqual(['▴', 'POD', 'Creating Invoice…']);
    expect(actions[0].props['aria-expanded']).toBe(true);
    expect(actions[2].props.disabled).toBe(true);
    expect(renderToStaticMarkup(<CxDiaryActions {...props} visibleTabs={[]} />)).not.toContain('View invoice');
  });
});
