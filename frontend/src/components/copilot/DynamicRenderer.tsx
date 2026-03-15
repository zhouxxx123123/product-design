/**
 * DynamicRenderer — renders a ComponentSchema at runtime.
 * Handles list, form, grid, table, and card layouts.
 */
import React, { useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type {
  ComponentSchema,
  SchemaItem,
  SchemaItemType,
} from '../../types/copilot';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Types ──

export interface DynamicRendererProps {
  schema: ComponentSchema;
  onSubmit?: (data: Record<string, unknown>) => void;
  className?: string;
}

interface RowData {
  id: string;
  values: Record<string, unknown>;
}

function makeRow(): RowData {
  return { id: crypto.randomUUID(), values: {} };
}

// ── Field renderer for a single SchemaItem ──

interface FieldCellProps {
  item: SchemaItem;
  value: unknown;
  onChange: (val: unknown) => void;
}

const FieldCell: React.FC<FieldCellProps> = ({ item, value, onChange }) => {
  const strVal = String(value ?? '');
  const inputClass =
    'w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white';

  switch (item.type as SchemaItemType) {
    case 'text_input':
      return (
        <input
          type="text"
          value={strVal}
          placeholder={item.label ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    case 'textarea':
      return (
        <textarea
          value={strVal}
          placeholder={item.label ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className={cn(inputClass, 'resize-none')}
        />
      );
    case 'badge':
      return (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
          {strVal || (item.label ?? '')}
        </span>
      );
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-indigo-600"
        />
      );
    case 'rating':
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                'w-6 h-6 text-sm rounded',
                Number(value) >= n
                  ? 'text-amber-400'
                  : 'text-slate-300 hover:text-amber-300',
              )}
            >
              ★
            </button>
          ))}
        </div>
      );
    case 'date_display':
      return (
        <input
          type="date"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
    default:
      return (
        <input
          type="text"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );
  }
};

// ── List layout ──

interface ListLayoutProps {
  schema: ComponentSchema;
  rows: RowData[];
  setRows: React.Dispatch<React.SetStateAction<RowData[]>>;
}

const ListLayout: React.FC<ListLayoutProps> = ({ schema, rows, setRows }) => {
  const [dragId, setDragId] = useState<string | null>(null);

  const updateValue = (rowId: string, field: string, val: unknown) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, values: { ...r.values, [field]: val } }
          : r,
      ),
    );
  };

  const deleteRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleDragStart = (id: string) => setDragId(id);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setRows((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((r) => r.id === dragId);
      const toIdx = next.findIndex((r) => r.id === targetId);
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDragId(null);
  };

  const itemDef = schema.items;

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.id}
          draggable={schema.draggable}
          onDragStart={() => handleDragStart(row.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(row.id)}
          className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg group"
        >
          {schema.draggable && (
            <GripVertical className="w-4 h-4 text-slate-300 cursor-grab flex-shrink-0" />
          )}
          <div className="flex-1">
            {itemDef && (
              <FieldCell
                item={itemDef}
                value={row.values[itemDef.field ?? 'value']}
                onChange={(val) =>
                  updateValue(row.id, itemDef.field ?? 'value', val)
                }
              />
            )}
          </div>
          {itemDef?.deletable && (
            <button
              type="button"
              onClick={() => deleteRow(row.id)}
              className="p-1 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Table layout ──

interface TableLayoutProps {
  schema: ComponentSchema;
  rows: RowData[];
  setRows: React.Dispatch<React.SetStateAction<RowData[]>>;
}

const TableLayout: React.FC<TableLayoutProps> = ({ schema, rows, setRows }) => {
  const columns = schema.columns ?? [];

  const updateCell = (rowId: string, key: string, val: unknown) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, values: { ...r.values, [key]: val } } : r,
      ),
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2">
                  <FieldCell
                    item={{ type: col.type ?? 'text_input', field: col.key, label: col.label }}
                    value={row.values[col.key]}
                    onChange={(val) => updateCell(row.id, col.key, val)}
                  />
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length || 1}
                className="px-3 py-6 text-center text-slate-400 text-xs"
              >
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ── DynamicRenderer ──

const DynamicRenderer: React.FC<DynamicRendererProps> = ({
  schema,
  onSubmit,
  className,
}) => {
  const [rows, setRows] = useState<RowData[]>(() => [
    makeRow(),
    makeRow(),
    makeRow(),
  ]);

  const appendItem = () => setRows((prev) => [...prev, makeRow()]);

  const collectData = (): Record<string, unknown> => ({
    layout: schema.layout,
    items: rows.map((r) => r.values),
  });

  const handleSubmit = () => {
    onSubmit?.(collectData());
  };

  return (
    <div className={cn('space-y-3', className)}>
      {schema.title && (
        <h4 className="text-sm font-semibold text-slate-700">{schema.title}</h4>
      )}

      {/* Toolbar */}
      {schema.toolbar && schema.toolbar.length > 0 && (
        <div className="flex gap-2">
          {schema.toolbar.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={action.type === 'append_item' ? appendItem : undefined}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Layout */}
      {(schema.layout === 'list' || schema.layout === undefined) && (
        <ListLayout schema={schema} rows={rows} setRows={setRows} />
      )}

      {schema.layout === 'table' && (
        <TableLayout schema={schema} rows={rows} setRows={setRows} />
      )}

      {schema.layout === 'grid' && (
        <div className="grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="p-3 bg-white border border-slate-200 rounded-lg"
            >
              {schema.items && (
                <FieldCell
                  item={schema.items}
                  value={row.values[schema.items.field ?? 'value']}
                  onChange={(val) =>
                    setRows((prev) =>
                      prev.map((r) =>
                        r.id === row.id
                          ? {
                              ...r,
                              values: {
                                ...r.values,
                                [schema.items?.field ?? 'value']: val,
                              },
                            }
                          : r,
                      ),
                    )
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}

      {schema.layout === 'form' && (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="space-y-2">
              {schema.items && (
                <div>
                  {schema.items.label && (
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {schema.items.label}
                    </label>
                  )}
                  <FieldCell
                    item={schema.items}
                    value={row.values[schema.items.field ?? 'value']}
                    onChange={(val) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.id === row.id
                            ? {
                                ...r,
                                values: {
                                  ...r.values,
                                  [schema.items?.field ?? 'value']: val,
                                },
                              }
                            : r,
                        ),
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {schema.layout === 'card' && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          {schema.items && rows[0] && (
            <FieldCell
              item={schema.items}
              value={rows[0].values[schema.items.field ?? 'value']}
              onChange={(val) =>
                setRows((prev) =>
                  prev.map((r, i) =>
                    i === 0
                      ? {
                          ...r,
                          values: {
                            ...r.values,
                            [schema.items?.field ?? 'value']: val,
                          },
                        }
                      : r,
                  ),
                )
              }
            />
          )}
        </div>
      )}

      {/* Submit */}
      {schema.submit && (
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {schema.submit.label}
        </button>
      )}
    </div>
  );
};

export default DynamicRenderer;
