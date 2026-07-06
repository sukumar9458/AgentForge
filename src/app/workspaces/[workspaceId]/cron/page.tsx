import React from "react";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Workspace } from "@/models/Workspace";
import { CronJob } from "@/models/CronJob";
import mongoose from "mongoose";
import CronDashboardClient from "./CronDashboardClient";

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

export const dynamic = "force-dynamic";

export default async function CronPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const { workspaceId } = await params;
  await connectToDatabase();

  const wId = new mongoose.Types.ObjectId(workspaceId);
  const uId = new mongoose.Types.ObjectId(session.user.id);

  // 1. Verify workspace access
  const workspace = await Workspace.findOne({
    _id: wId,
    "members.user": uId,
  });

  if (!workspace) {
    redirect("/dashboard");
  }

  // 2. Fetch existing cron job records for this workspace
  const cronJobsDocs = await CronJob.find({ workspaceId: wId })
    .sort({ createdAt: -1 })
    .lean();

  const cronJobs = cronJobsDocs.map((doc: any) => ({
    _id: doc._id.toString(),
    name: doc.name,
    workspaceId: doc.workspaceId.toString(),
    type: doc.type,
    githubRepo: doc.githubRepo || "",
    email: doc.email || "",
    prompt: doc.prompt,
    dayOfWeek: doc.dayOfWeek,
    hour: doc.hour,
    minute: doc.minute,
    active: doc.active,
    lastRunStatus: doc.lastRunStatus || "PENDING",
    lastRunTime: doc.lastRunTime ? doc.lastRunTime.toISOString() : "",
  }));

  return (
    <CronDashboardClient
      workspaceId={workspaceId}
      initialJobs={cronJobs}
    />
  );
}
