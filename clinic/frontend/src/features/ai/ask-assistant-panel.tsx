'use client';

import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';
import {
  askAiAssistant,
  getAiCapabilities,
  type AiChatResponse,
} from '@/services/api/ai';
import { ChatThread, type ChatMessage } from '@/features/ai/chat-thread';

export interface AskAssistantPanelProps {
  range?: { from: string; to: string };
  className?: string;
}

const DEFAULT_SUGGESTIONS = [
  'How many appointments were booked & completed?',
  'Which doctors have the highest workload?',
  'What is the bed occupancy in wards?',
  'Show pending and in-progress laboratory orders.',
  'Which medicines are low on stock or expiring soon?',
  'What is the total revenue and outstanding balance?',
];

export function AskAssistantPanel({ range, className }: AskAssistantPanelProps) {
  const role = useAuthStore((state) => state.user?.role);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastQuestion, setLastQuestion] = useState<string>('');

  const capabilities = useQuery({
    queryKey: ['ai', 'capabilities'],
    queryFn: getAiCapabilities,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const availableCaps = capabilities.data?.capabilities ?? [];

  const ask = useMutation({
    mutationFn: async ({ question, capabilityId }: { question: string; capabilityId: string }) => {
      const activeConversationId =
        messages.filter((m) => m.conversationId).pop()?.conversationId ?? null;

      return askAiAssistant({
        capabilityId,
        message: question,
        conversationId: activeConversationId,
        arguments: range ? { from: range.from, to: range.to } : undefined,
      });
    },
    onSuccess: (answer: AiChatResponse, { question }) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: question,
        createdAt: new Date().toISOString(),
      };

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: answer.answer,
        conversationId: answer.conversationId,
        reviewNotice: answer.reviewNotice,
        requiresReview: answer.requiresHumanReview,
        sources: answer.sources,
        createdAt: answer.computedAt ?? new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
    },
  });

  const inferCapability = (questionText: string): string => {
    const lower = questionText.toLowerCase();
    if (lower.includes('doctor') || lower.includes('workload') || lower.includes('staff')) {
      return availableCaps.some((c) => c.id === 'staff_workload') ? 'staff_workload' : 'appointment_metrics';
    }
    if (lower.includes('lab') || lower.includes('test') || lower.includes('specimen') || lower.includes('order')) {
      return availableCaps.some((c) => c.id === 'laboratory_workload') ? 'laboratory_workload' : 'operational_forecast';
    }
    if (lower.includes('medicine') || lower.includes('stock') || lower.includes('pharmacy') || lower.includes('expir')) {
      return availableCaps.some((c) => c.id === 'pharmacy_inventory') ? 'pharmacy_inventory' : 'operational_forecast';
    }
    if (lower.includes('revenue') || lower.includes('bill') || lower.includes('balance') || lower.includes('pay') || lower.includes('invoice') || lower.includes('cash')) {
      return availableCaps.some((c) => c.id === 'financial_summary') ? 'financial_summary' : 'operational_forecast';
    }
    if (lower.includes('patient') || lower.includes('register')) {
      return availableCaps.some((c) => c.id === 'patient_registrations') ? 'patient_registrations' : 'appointment_metrics';
    }
    if (lower.includes('slot') || lower.includes('availab')) {
      return availableCaps.some((c) => c.id === 'available_slots') ? 'available_slots' : 'appointment_metrics';
    }
    return (
      availableCaps.find((c) => c.id === 'appointment_metrics')?.id ??
      availableCaps.find((c) => c.id === 'operational_forecast')?.id ??
      availableCaps[0]?.id ??
      'appointment_metrics'
    );
  };

  const handleSend = (question: string) => {
    setLastQuestion(question);
    const capabilityId = inferCapability(question);
    ask.mutate({ question, capabilityId });
  };

  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  return (
    <Card className={`flex h-full flex-col justify-between border border-border bg-card shadow-sm ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Bot className="h-4 w-4 text-blue-500" />
            {isSuperAdmin ? 'Ask about the hospital' : 'Ask about clinical operations'}
          </h3>
          <span className="text-xs text-muted-foreground">Read-only live records</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between p-4 pt-1">
        <div className="flex-1 min-h-[320px] max-h-[460px]">
          <ChatThread
            messages={messages}
            loading={ask.isPending}
            error={ask.error ? (ask.error as Error).message : null}
            suggestions={DEFAULT_SUGGESTIONS}
            showSuggestions={messages.length === 0}
            onSend={handleSend}
            onRetry={() => {
              if (lastQuestion) handleSend(lastQuestion);
            }}
            placeholder="Ask about appointments, patients, wards, medicines or revenue..."
          />
        </div>

        {availableCaps.length > 0 && (
          <details className="mt-3 text-xs border-t border-border pt-2">
            <summary className="cursor-pointer text-muted-foreground transition hover:text-foreground">
              What this assistant can answer ({availableCaps.length} verified modules)
            </summary>
            <ul className="mt-1.5 space-y-1 pl-4 list-disc text-muted-foreground">
              {availableCaps.map((c) => (
                <li key={c.id}>
                  <strong className="text-foreground">{c.label}:</strong> {c.description}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default AskAssistantPanel;
