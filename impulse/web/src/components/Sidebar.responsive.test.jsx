// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

const stylesheet = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const component = readFileSync(resolve(process.cwd(), 'src/components/Sidebar.jsx'), 'utf8');
const css = postcss.parse(stylesheet);
const mobileRules = css.nodes.find((node) => node.type === 'atrule' && node.params === '(max-width: 767.98px)');

afterEach(cleanup);

describe('user portal mobile navigation', () => {
  it('shows four primary links and a More menu in the phone navigation', () => {
    const rules = [];
    mobileRules.walkRules((rule) => rules.push(rule));
    const sidebar = rules.find((rule) => rule.selector === '.app-sidebar');
    const nav = rules.find((rule) => rule.selector === '.app-sidebar-nav');
    const hiddenLinks = rules.find((rule) => rule.selector === '.app-sidebar-nav > .app-sidebar-link:nth-child(n + 5)');
    const destinations = component.match(/\{ path: '\/[^']*', icon:/g) || [];

    expect(destinations).toHaveLength(10);
    expect(sidebar.nodes.find((node) => node.prop === 'position').value).toBe('fixed');
    expect(nav.nodes.find((node) => node.prop === 'grid-template-columns').value).toBe('repeat(5, minmax(0, 1fr))');
    expect(nav.nodes.find((node) => node.prop === 'grid-template-rows').value).toBe('minmax(3.25rem, auto)');
    expect(hiddenLinks.nodes.find((node) => node.prop === 'display').value).toBe('none');
    expect(component).toContain('<Menu className="h-5 w-5"');
  });

  it('reveals the remaining six sections on demand and closes the menu after navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('navigation', { name: 'More navigation' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));

    const moreNavigation = screen.getByRole('navigation', { name: 'More navigation' });
    expect(within(moreNavigation).getAllByRole('link')).toHaveLength(6);
    expect(within(moreNavigation).getByRole('link', { name: /Custom Test/ })).toHaveAttribute('href', '/custom-test');
    expect(within(moreNavigation).getByRole('link', { name: /Calendar/ })).toHaveAttribute('href', '/calendar');

    fireEvent.click(within(moreNavigation).getByRole('link', { name: /Calendar/ }));
    expect(screen.queryByRole('navigation', { name: 'More navigation' })).not.toBeInTheDocument();
  });

  it('scopes mobile app-shell overrides to the phone breakpoint', () => {
    expect(mobileRules).toBeDefined();
    mobileRules.walkRules((rule) => {
      rule.selectors.forEach((selector) => {
        expect(['.app-layout', '.app-sidebar', '.app-sidebar-brand', '.app-sidebar-nav', '.app-sidebar-nav > .app-sidebar-link:nth-child(n + 5)', '.app-sidebar-link', '.app-sidebar-link svg', '.app-sidebar-label', '.app-sidebar-more', '.app-sidebar-more svg', '.app-sidebar-more-menu', '.app-sidebar-more-link', '.app-sidebar-more-link span', '.app-sidebar-more-link svg', '.main-content'])
          .toContain(selector.trim());
      });
    });
  });
});
