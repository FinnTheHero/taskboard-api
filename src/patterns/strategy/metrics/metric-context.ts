export interface ColumnInfo {
  id: string;
  title: string;
  position: number;
  boardId: string;
}

export interface MetricContext {
  columnIds: string[];
  columns: ColumnInfo[];
  doneColumnId: string | null;
  /** Column IDs excluded from overdue counts (typically Done). */
  overdueColumnIds: string[];
}

export function buildMetricContext(columns: ColumnInfo[]): MetricContext {
  const doneColumn = columns.find((c) => c.title === "Done");
  const doneColumnId = doneColumn?.id ?? null;
  const overdueColumnIds = doneColumnId
    ? columns.filter((c) => c.id !== doneColumnId).map((c) => c.id)
    : columns.map((c) => c.id);

  return {
    columnIds: columns.map((c) => c.id),
    columns: [...columns].sort((a, b) => a.position - b.position),
    doneColumnId,
    overdueColumnIds,
  };
}
