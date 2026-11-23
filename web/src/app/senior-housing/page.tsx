import { ProgramPage, programMetadata } from "@/components/program-page";

export const dynamic = "force-dynamic";

export const generateMetadata = () => programMetadata("SENIOR");

export default function SeniorHousingPage() {
  return <ProgramPage program="SENIOR" />;
}
