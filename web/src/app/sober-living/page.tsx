import { ProgramPage, programMetadata } from "@/components/program-page";

export const dynamic = "force-dynamic";

export const generateMetadata = () => programMetadata("RECOVERY");

export default function SoberLivingPage() {
  return <ProgramPage program="RECOVERY" />;
}
