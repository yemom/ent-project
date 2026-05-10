import { useEffect, useState } from "react";
import {
  listPrescriptionOrders,
  PrescriptionOrderItem
} from "@/features/prescriptions";
import { getFriendlyErrorMessage } from "@/lib/error-handler";

interface UsePrescriptionOrdersOptions {
  status?: "PENDING" | "DISPENSED" | "REJECTED";
  enabled?: boolean;
}

export function usePrescriptionOrders(options: UsePrescriptionOrdersOptions = {}) {
  const [orders, setOrders] = useState<PrescriptionOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options.enabled === false) return;

    const fetchOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await listPrescriptionOrders({ status: options.status });
        setOrders(data.content || []);
      } catch (err: any) {
        setError(getFriendlyErrorMessage(err, "We could not load prescription orders right now. Please try again."));
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [options.status, options.enabled]);

  return { orders, isLoading, error };
}
