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
import {
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "uiofcraft";

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
    <Table className="table-fixed">
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              return (
                <TableHead
                  key={header.id}
                  aria-sort={
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                        ? "descending"
                        : undefined
                  }
                  className={cn(
                    "px-3",
                    header.column.columnDef.meta?.className,
                  )}
                >
                  {header.column.getCanSort() ? (
                    <button
                      type="button"
                      className={cn(
                        "-mx-1 inline-flex h-6 items-center gap-1 rounded-sm px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                        sorted && "text-foreground",
                      )}
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
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className={cn(
              "has-[[data-list-row]:focus-visible]:bg-accent",
              rowClassName,
            )}
          >
            {row.getAllCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cn(
                  "px-3 py-0 leading-normal",
                  cell.column.columnDef.meta?.className,
                )}
              >
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
