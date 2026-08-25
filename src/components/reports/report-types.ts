export type StatusBreakdownDatum = {
  name: string;
  value: number;
  color: string;
};

export type VelocityDatum = {
  name: string;
  committed: number;
  completed: number;
};

export type PriorityBreakdownDatum = {
  name: string;
  value: number;
};

export type CycleTimeMetrics = {
  averageDays: number;
  p85Days: number;
};

export type BurndownDatum = {
  day: string;
  ideal: number;
  remaining: number;
};

export type ReportData = {
  statusBreakdown: readonly StatusBreakdownDatum[];
  velocity: readonly VelocityDatum[];
  priorityBreakdown: readonly PriorityBreakdownDatum[];
  cycleTime: CycleTimeMetrics;
  burndown: readonly BurndownDatum[];
};

export type ReportsDashboardProps = {
  data: ReportData;
  className?: string;
};
