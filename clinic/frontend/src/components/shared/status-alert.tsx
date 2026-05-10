"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect, useState } from "react";

export type StatusType = "success" | "error" | null;

interface StatusAlertProps {
  status: StatusType;
  message?: string;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  autoDismissMs?: number;
}

/**
 * StatusAlert Component
 * 
 * Displays success or error messages with optional auto-dismiss.
 * Used for page-level feedback instead of alerts and console errors.
 * 
 * Usage:
 * const [status, setStatus] = useState<StatusType>(null);
 * const [message, setMessage] = useState('');
 * 
 * <StatusAlert 
 *   status={status} 
 *   message={message}
 *   onDismiss={() => setStatus(null)}
 *   autoDismiss={true}
 * />
 * 
 * // In error handler:
 * setStatus('error');
 * setMessage(getFriendlyErrorMessage(err, 'Operation failed'));
 */
export function StatusAlert({
  status,
  message,
  onDismiss,
  autoDismiss = true,
  autoDismissMs = 5000,
}: StatusAlertProps) {
  const [isVisible, setIsVisible] = useState(!!status);

  useEffect(() => {
    setIsVisible(!!status);
    
    if (status && autoDismiss) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoDismissMs);

      return () => clearTimeout(timer);
    }
  }, [status, autoDismiss, autoDismissMs, onDismiss]);

  if (!isVisible || !status) return null;

  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
      ) : isError ? (
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
      ) : null}

      <div className="flex-1">
        <p className="font-medium">{message}</p>
      </div>

      {onDismiss && (
        <button
          onClick={() => {
            setIsVisible(false);
            onDismiss();
          }}
          className="flex-shrink-0 text-current hover:opacity-70"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
