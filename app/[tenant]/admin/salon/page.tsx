import { MapaSalon } from "@/components/salon/MapaSalon";

export const metadata = {
  title: "Salón | MMM System",
  description: "Gestión de mesas y salón",
};

export default function SalonPage() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <MapaSalon />
    </div>
  );
}
