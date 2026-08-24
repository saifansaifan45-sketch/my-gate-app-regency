import React from 'react';
import { useSyncExternalStore } from 'react';
import { Feather } from '@expo/vector-icons';

export type FeatherName = React.ComponentProps<typeof Feather>['name'];

export interface Issue {
  id: string;
  category: string;
  icon: FeatherName;
  title: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  time: string;
}

export const ISSUE_CATEGORIES = [
  { id: 'Plumbing', label: 'Plumbing', icon: 'droplet' as FeatherName, color: '#1D6FC4', bg: '#E3F2FD', hint: 'Leaks, taps, pipes' },
  { id: 'Electrical', label: 'Electrical', icon: 'zap' as FeatherName, color: '#D97706', bg: '#FEF3C7', hint: 'Lights, switches, sockets' },
  { id: 'Lift', label: 'Lift', icon: 'arrow-up' as FeatherName, color: '#7E22CE', bg: '#F3E8FF', hint: 'Elevator, doors, noise' },
  { id: 'Maintenance', label: 'Maintenance', icon: 'tool' as FeatherName, color: '#1B7A44', bg: '#E8F5E9', hint: 'General maintenance' },
  { id: 'Security', label: 'Security', icon: 'shield' as FeatherName, color: '#E11D48', bg: '#FFE4E6', hint: 'Access, gates, cameras' },
  { id: 'Custom', label: 'Custom', icon: 'edit-3' as FeatherName, color: '#4B5563', bg: '#F3F4F6', hint: 'Something else' },
];

let issues: Issue[] = [];

let cachedIssues: Issue[] | null = null;
let cachedOpenIssues: Issue[] | null = null;

const listeners = new Set<() => void>();

function recompute() {
  cachedIssues = issues;
  cachedOpenIssues = issues.filter((i) => i.status !== 'Resolved');
}

function emit() {
  recompute();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

recompute();

export function getIssues(): Issue[] {
  return cachedIssues!;
}

export function getOpenIssues(): Issue[] {
  return cachedOpenIssues!;
}

export function addIssue(issue: Issue) {
  issues = [issue, ...issues];
  emit();
}

export function setIssuesList(newIssues: Issue[]) {
  issues = newIssues;
  emit();
}

export function removeIssue(id: string) {
  issues = issues.filter((i) => i.id !== id);
  emit();
}

export function useIssues(): Issue[] {
  return useSyncExternalStore(subscribe, getIssues);
}

export function useOpenIssues(): Issue[] {
  return useSyncExternalStore(subscribe, getOpenIssues);
}