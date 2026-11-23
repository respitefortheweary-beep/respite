import { ProgramPage, programMetadata } from "@/components/program-page";

export const dynamic = "force-dynamic";

export const generateMetadata = () => programMetadata("VETERAN");

export default function VeteranHousingPage() {
  return <ProgramPage program="VETERAN" />;
}
