import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/ssr";
import {
  type ColumnDef,
  createColumnHelper,
  functionalUpdate,
  type RowData,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { listRowClass } from "./ui";

const features = tableFeatures({
  rowSortingFeature,
  columnMeta: {} as { className?: string },
});

export type Features = typeof features;
export type { SortingState };

export function columnHelper<Row extends RowData>() {
  return createColumnHelper<Features, Row>();
}

export function DataTable<Row extends RowData>({
  columns,
  data,
  getRowId,
  sorting,
  onSortingChange,
  rowClassName = "h-11",
}: {
  columns: ReadonlyArray<ColumnDef<Features, Row, unknown>>;
  data: Row[];
  getRowId: (row: Row) => string;
  sorting: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  rowClassName?: string;
}) {
  const table = useTable({
    features,
    columns,
    data,
    getRowId,
    manualSorting: true,
    enableSorting: onSortingChange !== undefined,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange: (updater) =>
      onSortingChange?.(functionalUpdate(updater, sorting)),
  });

  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr
            key={group.id}
            className="h-8 border-b border-border bg-surface-2 text-left text-2xs font-medium text-muted"
          >
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              const className = header.column.columnDef.meta?.className ?? "";
              return (
                <th
                  key={header.id}
                  aria-sort={
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                        ? "descending"
                        : undefined
                  }
                  className={`px-3 font-medium ${className}`}
                >
                  {header.column.getCanSort() ? (
                    <button
                      type="button"
                      className={`-mx-1 inline-flex h-6 items-center gap-1 rounded-xs px-1 hover:text-text ${
                        sorted ? "text-text" : ""
                      }`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={header} />
                      {sorted === "asc" && (
                        <CaretUpIcon size={10} weight="bold" />
                      )}
                      {sorted === "desc" && (
                        <CaretDownIcon size={10} weight="bold" />
                      )}
                    </button>
                  ) : (
                    <table.FlexRender header={header} />
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} className={`${listRowClass} ${rowClassName}`}>
            {row.getAllCells().map((cell) => (
              <td
                key={cell.id}
                className={`px-3 ${cell.column.columnDef.meta?.className ?? ""}`}
              >
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
