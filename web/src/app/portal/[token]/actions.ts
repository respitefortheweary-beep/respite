"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "@/lib/api";

const ids = (form: FormData) => String(form.get("charges") ?? "").split(",").filter(Boolean);

export type PayState = { error?: string } | null;

/** Dollars typed by the resident, as cents. Blank means pay it all. */
const cents = (form: FormData) => {
  const raw = String(form.get("amount") ?? "").replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Math.round(Number(raw) * 100);
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

/** Sends the resident to Stripe Checkout, or to the test-mode pay screen when Stripe isn't set up. */
export async function startCheckout(token: string, _: PayState, form: FormData): Promise<PayState> {
  const amountCents = cents(form);
  if (Number.isNaN(amountCents)) return { error: "Enter an amount, like 150." };
  let url: string;
  try {
    ({ url } = await api.post<{ url: string }>(`/portal/${encodeURIComponent(token)}/checkout`, { chargeIds: ids(form), amountCents }));
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) return { error: e.message };
    throw e;
  }
  redirect(url);
}

/** The resident will bring cash, a check, a money order or a voucher to the house. The owners are told. */
export async function payInPerson(token: string, form: FormData) {
  await api.post(`/portal/${encodeURIComponent(token)}/in-person`, { chargeIds: ids(form), method: String(form.get("method") ?? "") });
  revalidatePath("/", "layout");
  redirect(`/portal/${token}?inperson=1`);
}

/** Test mode only: records the payment without moving money. */
export async function demoPay(token: string, chargeIds: string[], amountCents: number | null) {
  await api.post(`/portal/${encodeURIComponent(token)}/demo-pay`, { chargeIds, amountCents });
  revalidatePath("/", "layout");
  redirect(`/portal/${token}?paid=1`);
}

/** Saves a card or bank account for autopay: Stripe's secure page, or straight back in test mode. */
export async function startAutopay(token: string) {
  const { url } = await api.post<{ url: string }>(`/portal/${encodeURIComponent(token)}/autopay`, {});
  redirect(url);
}

export async function stopAutopay(token: string) {
  await api.delete(`/portal/${encodeURIComponent(token)}/autopay`);
  revalidatePath(`/portal/${token}`);
  redirect(`/portal/${token}?autopay=off`);
}

export type RepairState = { error?: string; ok?: string } | null;

/** A resident telling the house something needs fixing. The owners get an alert right away. */
export async function reportRepair(token: string, _: RepairState, form: FormData): Promise<RepairState> {
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 3) return { error: "Tell us what needs fixing." };
  try {
    await api.post(`/portal/${encodeURIComponent(token)}/repairs`, {
      area: String(form.get("area") ?? "Other"),
      body,
      urgent: form.get("urgent") === "on",
    });
  } catch (e) {
    if (e instanceof ApiError && e.status < 500) return { error: e.message };
    throw e;
  }
  revalidatePath(`/portal/${token}`);
  return { ok: "Sent. The house has been told." };
}
