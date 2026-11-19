import Link from "next/link";
import { admin } from "@/lib/api";
import { Page } from "../../ui";
import { AddHouseForm } from "./add-house";

export default async function NewHousePage() {
  const { canUploadPhotos } = await admin.get<{ canUploadPhotos: boolean }>("/admin/config");
  return (
    <Page
      title="Add a house"
      crumb={
        <>
          <Link href="/admin/houses" className="hover:text-ink">
            Houses
          </Link>
          <span aria-hidden>/</span>
          <span>New house</span>
        </>
      }
    >
      <AddHouseForm canUpload={!process.env.SHOWCASE && canUploadPhotos} />
    </Page>
  );
}
