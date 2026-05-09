import { PharmacistLayout } from "@/features/pharmacist/pharmacist-layout";

export default function PharmaistRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PharmacistLayout>{children}</PharmacistLayout>;
}
