"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

export default function CampaignIndex() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const step = useStore((s) => s.campaigns[id]?.step ?? 1);
  useEffect(() => { router.replace(`/campaigns/${id}/${["brief", "build", "plan"][step - 1]}`); }, [id, step, router]);
  return null;
}
