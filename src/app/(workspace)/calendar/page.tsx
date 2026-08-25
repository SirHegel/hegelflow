import type { Metadata } from "next";
import { WorkCalendar } from "@/components/calendar/work-calendar";
import { getBacklogData } from "@/lib/data";
import { requirePageContext } from "@/lib/page-context";
import { dateKeyInTimeZone } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarPage() {
  const { context, session } = await requirePageContext();
  const data = await getBacklogData(context.workspaceId, context.membershipId, context.accessLevel);
  return <WorkCalendar tasks={data.tasks} sprints={data.sprints} board={data.board} initialTodayKey={dateKeyInTimeZone(new Date(), session.user.timezone)} timeZone={session.user.timezone} />;
}
